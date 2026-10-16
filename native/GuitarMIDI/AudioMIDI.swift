import Foundation
import AVFoundation
import CoreAudio
import CoreMIDI
import AudioToolbox

struct GuitarInput: Identifiable {
    let id: AudioDeviceID
    let name: String
    let channels: Int
}

func inputDevices(scope: AudioObjectPropertyScope = kAudioDevicePropertyScopeInput) -> [GuitarInput] {
    var address = AudioObjectPropertyAddress(mSelector: kAudioHardwarePropertyDevices, mScope: kAudioObjectPropertyScopeGlobal, mElement: kAudioObjectPropertyElementMain)
    var size: UInt32 = 0
    guard AudioObjectGetPropertyDataSize(AudioObjectID(kAudioObjectSystemObject), &address, 0, nil, &size) == noErr else { return [] }
    var ids = [AudioDeviceID](repeating: 0, count: Int(size) / MemoryLayout<AudioDeviceID>.size)
    guard AudioObjectGetPropertyData(AudioObjectID(kAudioObjectSystemObject), &address, 0, nil, &size, &ids) == noErr else { return [] }
    return ids.compactMap { id in
        var streams = AudioObjectPropertyAddress(mSelector: kAudioDevicePropertyStreamConfiguration, mScope: scope, mElement: kAudioObjectPropertyElementMain)
        var bytes: UInt32 = 0
        guard AudioObjectGetPropertyDataSize(id, &streams, 0, nil, &bytes) == noErr, bytes > 0 else { return nil }
        let raw = UnsafeMutableRawPointer.allocate(byteCount: Int(bytes), alignment: MemoryLayout<AudioBufferList>.alignment)
        defer { raw.deallocate() }
        guard AudioObjectGetPropertyData(id, &streams, 0, nil, &bytes, raw) == noErr else { return nil }
        let buffers = UnsafeMutableAudioBufferListPointer(raw.assumingMemoryBound(to: AudioBufferList.self))
        let channels = buffers.reduce(0) { $0 + Int($1.mNumberChannels) }
        guard channels > 0 else { return nil }
        var nameAddress = AudioObjectPropertyAddress(mSelector: kAudioObjectPropertyName, mScope: kAudioObjectPropertyScopeGlobal, mElement: kAudioObjectPropertyElementMain)
        var name: Unmanaged<CFString>?
        var nameSize = UInt32(MemoryLayout<CFString>.size)
        _ = AudioObjectGetPropertyData(id, &nameAddress, 0, nil, &nameSize, &name)
        return GuitarInput(id: id, name: (name?.takeRetainedValue() as String?) ?? "Audio input", channels: channels)
    }
}

func check(_ status: OSStatus, _ action: String) throws {
    if status != noErr { throw NSError(domain: "GuitarMIDI", code: Int(status), userInfo: [NSLocalizedDescriptionKey: "\(action) failed (\(status))"]) }
}

final class GuitarMIDIPort {
    var client = MIDIClientRef()
    var source = MIDIEndpointRef()
    init(name: String = "Alive Guitar MIDI") throws {
        try check(MIDIClientCreateWithBlock(name as CFString, &client, nil), "Create MIDI client")
        do { try check(MIDISourceCreate(client, name as CFString, &source), "Create MIDI source") }
        catch { MIDIClientDispose(client); client = 0; throw error }
    }
    @discardableResult func send(_ note: Int, _ velocity: Int) -> OSStatus {
        var list = MIDIPacketList()
        let bytes: [UInt8] = [velocity > 0 ? 0x90 : 0x80, UInt8(note), UInt8(velocity)]
        return withUnsafeMutablePointer(to: &list) { pointer in
            let packet = MIDIPacketListInit(pointer)
            return bytes.withUnsafeBufferPointer { data in
                _ = MIDIPacketListAdd(pointer, MemoryLayout<MIDIPacketList>.size, packet, 0, 3, data.baseAddress!)
                return MIDIReceived(source, pointer)
            }
        }
    }
    func panic() { for note in 0...127 { send(note, 0) } }
    deinit {
        panic()
        if source != 0 { MIDIEndpointDispose(source) }
        if client != 0 { MIDIClientDispose(client) }
    }
}

// All conversion/inference runs on one queue. A nonblocking semaphore bounds
// capture work to one buffer; overruns reset note state instead of accumulating lag.
final class GuitarCapture {
    let engine = AVAudioEngine()
    let worker = DispatchQueue(label: "alive.guitar.inference", qos: .userInitiated)
    let slot = DispatchSemaphore(value: 1)
    let gapLock = NSLock()
    var gap = false
    var dropped = 0
    var detector: GuitarDetector?
    var midi: GuitarMIDIPort?
    var observer: NSObjectProtocol?
    var installedTap = false
    var report: (([Int], Double, Float, Int) -> Void)?
    var failed: ((String) -> Void)?
    var configurationChanged: (() -> Void)?
    private var captureFormat: AVAudioFormat?
    private var captureDevice = AudioDeviceID(0)

    // Check on the main queue, after the notification callback has returned.
    // Some route notifications arrive while the configured input is still healthy.
    var requiresReconnect: Bool {
        let node = engine.inputNode
        guard engine.isRunning, let captureFormat, let unit = node.audioUnit else { return true }
        var id = AudioDeviceID(0), size = UInt32(MemoryLayout<AudioDeviceID>.size)
        guard AudioUnitGetProperty(unit, kAudioOutputUnitProperty_CurrentDevice, kAudioUnitScope_Global, 0, &id, &size) == noErr,
              id == captureDevice else { return true }
        return !node.inputFormat(forBus: 0).isEqual(captureFormat) || !node.outputFormat(forBus: 0).isEqual(captureFormat)
    }

    func start(device: AudioDeviceID, channel: Int, modelURL: URL, gate: Float, threshold: Float, timing: DetectorTiming, compute: DetectorCompute, midiName: String = "Alive Guitar MIDI") throws {
        let detector = try GuitarDetector(url: modelURL, timing: timing, compute: compute)
        detector.gateDB = gate
        detector.threshold = threshold
        let midi = try GuitarMIDIPort(name: midiName)
        detector.send = { [weak self, weak midi] note, velocity in
            guard let midi else { return }
            let result = midi.send(note, velocity)
            if result != noErr { self?.failed?("MIDI delivery failed (\(result)). Restart the input.") }
        }
        self.detector = detector
        self.midi = midi
        let node = engine.inputNode
        if device != 0 {
            guard let unit = node.audioUnit else {
                throw NSError(domain: "GuitarMIDI", code: 2, userInfo: [NSLocalizedDescriptionKey: "The audio input could not be opened. Reconnect it and try again."])
            }
            var id = device
            try check(AudioUnitSetProperty(unit, kAudioOutputUnitProperty_CurrentDevice, kAudioUnitScope_Global, 0, &id, UInt32(MemoryLayout<AudioDeviceID>.size)), "Select audio input")
        }
        // Selecting a device updates the hardware input format, but the node's
        // output can retain the previous device's channel count and sample rate.
        // Installing the tap with the input format also configures that output.
        let hardware = node.inputFormat(forBus: 0)
        guard let unit = node.audioUnit else {
            throw NSError(domain: "GuitarMIDI", code: 2, userInfo: [NSLocalizedDescriptionKey: "The audio input could not be opened."])
        }
        var deviceSize = UInt32(MemoryLayout<AudioDeviceID>.size)
        try check(AudioUnitGetProperty(unit, kAudioOutputUnitProperty_CurrentDevice, kAudioUnitScope_Global, 0, &captureDevice, &deviceSize), "Verify audio input")
        captureFormat = hardware
        guard hardware.sampleRate > 0, hardware.commonFormat == .pcmFormatFloat32, !hardware.isInterleaved,
              channel >= 0, channel < Int(hardware.channelCount),
              let mono = AVAudioFormat(commonFormat: .pcmFormatFloat32, sampleRate: hardware.sampleRate, channels: 1, interleaved: false),
              let target = AVAudioFormat(commonFormat: .pcmFormatFloat32, sampleRate: GuitarDetector.sampleRate, channels: 1, interleaved: false),
              let converter = AVAudioConverter(from: mono, to: target) else {
            throw NSError(domain: "GuitarMIDI", code: 2, userInfo: [NSLocalizedDescriptionKey: "Cannot open channel \(channel + 1). The input reports \(hardware.channelCount) channels at \(Int(hardware.sampleRate)) Hz. Reconnect the input and refresh devices."])
        }
        node.installTap(onBus: 0, bufferSize: 1024, format: hardware) { [weak self] buffer, _ in
            guard let self, let data = buffer.floatChannelData else { return }
            guard channel < Int(buffer.format.channelCount), buffer.format.sampleRate == hardware.sampleRate else {
                self.failed?("Audio input format changed unexpectedly. Select your input and start again.")
                return
            }
            guard self.slot.wait(timeout: .now()) == .success else {
                self.gapLock.lock(); self.gap = true; self.dropped += 1; self.gapLock.unlock()
                return
            }
            // ponytail: AVAudioEngine tap prototype copies one mono buffer. A
            // preallocated SPSC ring is the next step if live profiling finds dropouts.
            guard let copy = AVAudioPCMBuffer(pcmFormat: mono, frameCapacity: buffer.frameLength) else { self.slot.signal(); return }
            copy.frameLength = buffer.frameLength
            copy.floatChannelData![0].update(from: data[channel], count: Int(buffer.frameLength))
            self.worker.async {
                defer { self.slot.signal() }
                self.gapLock.lock(); let gap = self.gap; self.gap = false; let dropped = self.dropped; self.gapLock.unlock()
                if gap { converter.reset(); detector.reset() }
                let capacity = AVAudioFrameCount(ceil(Double(copy.frameLength) * target.sampleRate / mono.sampleRate) + 64)
                guard let output = AVAudioPCMBuffer(pcmFormat: target, frameCapacity: capacity) else { return }
                var supplied = false
                var error: NSError?
                let state = converter.convert(to: output, error: &error) { _, status in
                    if supplied { status.pointee = .noDataNow; return nil }
                    supplied = true; status.pointee = .haveData; return copy
                }
                if state == .error { self.failed?(error?.localizedDescription ?? "Audio conversion failed"); return }
                let samples = Array(UnsafeBufferPointer(start: output.floatChannelData![0], count: Int(output.frameLength)))
                do {
                    try detector.append(samples)
                    let rms = sqrt(samples.reduce(Float(0)) { $0 + $1 * $1 } / Float(max(1, samples.count)))
                    self.report?(detector.tracker.active.sorted(), detector.inferenceMS, 20 * log10(max(rms, 1e-9)), dropped)
                } catch { self.failed?(error.localizedDescription) }
            }
        }
        installedTap = true
        engine.prepare()
        try engine.start()
        observer = NotificationCenter.default.addObserver(forName: .AVAudioEngineConfigurationChange, object: engine, queue: nil) { [weak self] _ in
            // Output routing can stop this input-only graph too. The owner
            // rebuilds it asynchronously, never on Core Audio's notification queue.
            self?.configurationChanged?()
        }

    }

    func stop() {
        if let observer { NotificationCenter.default.removeObserver(observer) }
        observer = nil
        engine.stop()
        if installedTap { engine.inputNode.removeTap(onBus: 0); installedTap = false }
        worker.sync { detector?.reset(); midi?.panic(); detector = nil; midi = nil }
    }
    deinit { stop() }
}
