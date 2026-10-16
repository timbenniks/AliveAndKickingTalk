import Foundation
import CoreMIDI

struct AmpCapture: Codable, Identifiable {
    let id: String
    let displayName: String
    let modelFile: String
    let category: String
    let reverbAmount: Double?
}
struct AmpCatalog: Codable { let presets: [AmpCapture] }

struct RigPreset: Codable, Identifiable, Equatable {
    var id = UUID().uuidString
    var name: String
    var modelFile: String
    var program: Int
    var input = 0.0
    var output = -12.0
    var gate = -70.0
    var reverb = 2.0

    var valid: Bool {
        !name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && name.count <= 80 &&
        !modelFile.isEmpty && modelFile == (modelFile as NSString).lastPathComponent && modelFile.hasSuffix(".nam") &&
        (0...127).contains(program) && input.isFinite && (-24...24).contains(input) &&
        output.isFinite && (-60...6).contains(output) && gate.isFinite && (-85 ... -30).contains(gate) &&
        reverb.isFinite && (0...10).contains(reverb)
    }
}

struct RigPresetStore {
    let url: URL
    init(url: URL = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        .appendingPathComponent("Alive Rig Preview/presets.json")) { self.url = url }
    func load() throws -> [RigPreset] {
        guard FileManager.default.fileExists(atPath: url.path) else { return [] }
        let presets = try JSONDecoder().decode([RigPreset].self, from: Data(contentsOf: url))
        try validate(presets)
        return presets
    }
    func validate(_ presets: [RigPreset]) throws {
        guard presets.allSatisfy(\.valid), Set(presets.map(\.id)).count == presets.count,
              Set(presets.map(\.program)).count == presets.count else {
            throw NSError(domain: "RigPresets", code: 1, userInfo: [NSLocalizedDescriptionKey: "Presets need valid settings and unique MIDI programs (0–127)."])
        }
    }
    func save(_ presets: [RigPreset]) throws {
        try validate(presets)
        try FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
        let encoder = JSONEncoder(); encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        try encoder.encode(presets).write(to: url, options: .atomic)
    }
}

// MIDI 1 byte stream, including running status and realtime bytes. Only channel 1
// Program Changes are used. SysEx and all other messages are ignored.
struct ProgramParser {
    var status: UInt8 = 0
    var remaining = 0
    mutating func feed(_ bytes: [UInt8]) -> [Int] {
        var programs: [Int] = []
        for byte in bytes {
            if byte >= 0xF8 { continue }
            if byte & 0x80 != 0 {
                status = byte < 0xF0 ? byte : 0
                remaining = status == 0 ? 0 : ((status & 0xE0) == 0xC0 ? 1 : 2)
                continue
            }
            guard status != 0 else { continue }
            if status == 0xC0 { programs.append(Int(byte)) }
            remaining -= 1
            if remaining == 0 { remaining = (status & 0xE0) == 0xC0 ? 1 : 2 }
        }
        return programs
    }
}

final class AmpMIDIPort {
    var client = MIDIClientRef()
    var destination = MIDIEndpointRef()
    private var parser = ProgramParser()
    var received: ((Int) -> Void)?
    init() throws {
        try check(MIDIClientCreateWithBlock("Alive Rig Preview Control" as CFString, &client, nil), "Create amp MIDI client")
        do {
            try check(MIDIDestinationCreateWithBlock(client, "Alive Rig Preview Control" as CFString, &destination) { [weak self] list, _ in
                // CoreMIDI can call on several threads. Copy packets here; parsing and
                // state changes are serialized on main, never in the audio callback.
                var packets: [[UInt8]] = []
                do {
                    var packet = UnsafeRawPointer(list).advanced(by: MemoryLayout<MIDIPacketList>.offset(of: \.packet)!).assumingMemoryBound(to: MIDIPacket.self)
                    for _ in 0..<list.pointee.numPackets {
                        let count = Int(packet.pointee.length)
                        let data = UnsafeRawPointer(packet).advanced(by: MemoryLayout<MIDIPacket>.offset(of: \.data)!).assumingMemoryBound(to: UInt8.self)
                        let bytes = Array(UnsafeBufferPointer(start: data, count: count))
                        packets.append(bytes)
                        packet = UnsafePointer(MIDIPacketNext(packet))
                    }
                }
                DispatchQueue.main.async { [weak self] in
                    guard let self else { return }
                    for packet in packets { for pc in self.parser.feed(packet) { self.received?(pc) } }
                }
            }, "Create amp MIDI destination")
        } catch { MIDIClientDispose(client); client = 0; throw error }
    }
    deinit {
        if destination != 0 { MIDIEndpointDispose(destination) }
        if client != 0 { MIDIClientDispose(client) }
    }
}
