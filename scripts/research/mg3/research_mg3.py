"""Reproduce the local MG3 study: pinned binary facts and optional Ghidra export.

No third-party Python packages. Exported proprietary artifacts stay outside Git.
This is an analysis utility, not a note detector or an MG3 engine implementation.
"""
from pathlib import Path
import argparse
import hashlib
import json
import math
import os
import shutil
import struct
import subprocess
import tempfile

ARM64_SHA256 = '0d2362d7760523f4169d9bbf6cb4ca03b675fda0a36a64b558bbae53129d672d'
DEFAULT_STUDY = Path.home() / '.codex/analyses/mg3-2026-10-15'


def read_virtual(data, address, length):
    if len(data) < 32 or struct.unpack_from('<I', data)[0] != 0xfeedfacf:
        raise ValueError('Expected a thin 64-bit Mach-O study copy')
    offset = 32
    for _ in range(struct.unpack_from('<I', data, 16)[0]):
        command, size = struct.unpack_from('<II', data, offset)
        if size < 8 or offset + size > len(data):
            raise ValueError('Invalid Mach-O load command')
        if command == 0x19:
            vm, _, file_offset, file_size = struct.unpack_from('<4Q', data, offset + 24)
            if vm <= address and address + length <= vm + file_size:
                start = file_offset + address - vm
                result = data[start:start + length]
                if len(result) == length:
                    return result
        offset += size
    raise ValueError(f'Unmapped file-backed address: {address:#x}')


def core32_windows(sample_rate, lowest_note):
    """Algebraic reading of 0x1001de594, not measured analysis latency."""
    lowest_hz = 440 * 2 ** ((lowest_note - 0.5 - 69) / 12)
    effective_hz = lowest_hz
    longest = math.floor(6 * sample_rate / effective_hz + 0.5)
    step = 0
    while longest > 8191:
        step += 1
        effective_hz = lowest_hz * (1 + step * 0.05)
        longest = math.floor(6 * sample_rate / effective_hz + 0.5)
    lengths = [math.floor(periods * sample_rate / effective_hz + 0.5) for periods in [2, 1.5, 3]] + [longest]
    return {
        'assumed_lower_midi_note': lowest_note,
        'lower_boundary_hz': lowest_hz,
        'effective_boundary_hz': effective_hz,
        'fft_size': 4096 if longest <= 4096 else 8192,
        'window_samples_in_constructor_order': lengths,
        'window_spans_ms_not_onset_latency': [1000 * n / sample_rate for n in lengths],
        'frequency_limit_hz': min(lowest_hz * 60, 20000),
    }


def binary_facts(binary):
    data = binary.read_bytes()
    digest = hashlib.sha256(data).hexdigest()
    if digest != ARM64_SHA256:
        raise ValueError(f'Binary hash mismatch: {digest}. Re-identify addresses before proceeding.')
    vector = struct.unpack('<2Q', read_virtual(data, 0x1008a2df0, 16))
    windows = {}
    for index in [2, 8]:
        displacement = struct.unpack('<H', read_virtual(data, 0x1008a7474 + index * 2, 2))[0]
        windows[str(index)] = hex(0x100143bd4 + displacement * 4)
    return {
        'arm64_sha256': digest,
        'bank_configuration_vector_at_0x1008a2df0': vector,
        'window_switch_destinations': windows,
        'core31_grid_hz': [(i + 5) ** 2 / 25.5 for i in [0, 32, 64, 128, 192, 255]],
        'core32_example_48k_E2': core32_windows(48000, 40),
        'caution': 'Lower note 40 is an illustration, not a verified live preset; no accuracy or latency measurement.',
    }


def self_test():
    # Include a non-zero segment file offset to catch mistaken VA-to-file mappings.
    data = bytearray(256)
    struct.pack_into('<8I', data, 0, 0xfeedfacf, 0x100000c, 0, 2, 1, 72, 0, 0)
    struct.pack_into('<II16s4Q', data, 32, 0x19, 72, b'__TEXT', 0x1000, 64, 128, 64)
    data[132:136] = b'TEST'
    assert read_virtual(data, 0x1004, 4) == b'TEST'
    try:
        read_virtual(data, 0x1040, 1)
    except ValueError:
        pass
    else:
        raise AssertionError('Expected rejection of an unmapped address')
    for sample_rate in [44100, 48000, 96000, 192000]:
        for note in [12, 38, 40, 64]:
            plan = core32_windows(sample_rate, note)
            lengths = plan['window_samples_in_constructor_order']
            assert 0 < min(lengths) <= max(lengths) <= 8191
            assert plan['fft_size'] >= max(lengths)
            assert lengths[1] < lengths[0] < lengths[2] < lengths[3]
    assert core32_windows(48000, 40)['window_samples_in_constructor_order'] == [1199, 899, 1799, 3597]
    print('Mach-O mapping and window-plan checks passed.')


def export_ghidra(study, output):
    here = Path(__file__).resolve().parent
    ghidra = study / 'tools/ghidra_12.1.4_PUBLIC/support/analyzeHeadless'
    java = study / 'tools/jdk-21.0.12.1+1/Contents/Home'
    project = study / 'project'
    for required in [ghidra, java, project / 'MG3Study.gpr', project / 'MG3Study.rep']:
        if not required.exists():
            raise ValueError(f'Missing study prerequisite: {required}')
    output = output.resolve()
    if output.exists():
        raise ValueError(f'Choose a new output directory to preserve earlier evidence: {output}')
    output.mkdir(parents=True)
    # Ghidra rejects project path components starting with a dot, including .codex.
    # A temporary independent project avoids that problem and shared project locks.
    with tempfile.TemporaryDirectory(prefix='mg3-study-', dir='/tmp') as temporary:
        copied = Path(temporary) / 'project'
        shutil.copytree(project, copied)
        command = [str(ghidra), str(copied), 'MG3Study', '-process', 'MG3-arm64',
                   '-readOnly', '-noanalysis', '-scriptPath', str(here),
                   '-postScript', 'DeepMG3.java', str(here / 'targets.txt'), str(output)]
        env = dict(os.environ, JAVA_HOME=str(java))
        with (output / 'ghidra.log').open('w') as log:
            completed = subprocess.run(command, env=env, stdout=log, stderr=subprocess.STDOUT, check=False)
        log_text = (output / 'ghidra.log').read_text()
        if completed.returncode or 'Exported ' not in log_text or 'Discarding changes' not in log_text:
            raise RuntimeError(f'Ghidra export not confirmed; inspect {output / "ghidra.log"}')
        print(f'Read-only Ghidra export verified: {output}')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--study', type=Path, default=DEFAULT_STUDY)
    parser.add_argument('--export', type=Path, help='New output directory outside the repository')
    parser.add_argument('--self-test', action='store_true')
    args = parser.parse_args()
    if args.self_test:
        self_test()
        return
    facts = binary_facts(args.study / 'input/MG3-arm64')
    if args.export:
        root = Path(__file__).resolve().parents[3]
        if args.export.resolve().is_relative_to(root):
            raise ValueError('Keep binary-derived exports outside this repository')
        export_ghidra(args.study, args.export)
        (args.export / 'binary-facts.json').write_text(json.dumps(facts, indent=2) + '\n')
    print(json.dumps(facts, indent=2))


if __name__ == '__main__':
    main()
