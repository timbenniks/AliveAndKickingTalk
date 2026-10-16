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

struct RigEffectSettings: Codable, Equatable {
    var delayEnabled = false
    var delayStyle = 1 // digital / tape
    var pingPong = false
    var delayTime = 380.0
    var division = 0 // milliseconds / quarter / dotted eighth / eighth / half
    var tempo = 120.0
    var feedback = 32.0
    var delayMix = 20.0
    var delayTone = 45.0
    var reverbEnabled = false
    var reverbStyle = 1 // room / hall
    var size = 65.0
    var preDelay = 25.0
    var reverbMix = 18.0
    var reverbTone = 45.0
    var width = 100.0
    var ducking = 30.0

    var delayMilliseconds: Double {
        guard division > 0 && division <= 4 else { return delayTime }
        return 60000 / tempo * [0, 1, 0.75, 0.5, 2][division]
    }
    var valid: Bool {
        [0, 1].contains(delayStyle) && [0, 1].contains(reverbStyle) && (0...4).contains(division) &&
        delayTime.isFinite && (20...2000).contains(delayTime) && tempo.isFinite && (40...240).contains(tempo) &&
        feedback.isFinite && (0...85).contains(feedback) && preDelay.isFinite && (0...150).contains(preDelay) &&
        [delayMix, reverbMix].allSatisfy { $0.isFinite && (0...60).contains($0) } &&
        [delayTone, size, reverbTone, width, ducking].allSatisfy { $0.isFinite && (0...100).contains($0) }
    }
    var audioParameters: RigEffectsParameters {
        var p = RigEffectsParameters()
        p.delayEnabled = delayEnabled ? 1 : 0; p.delayTape = Int32(delayStyle); p.delayPingPong = pingPong ? 1 : 0
        p.delayMS = Float(delayMilliseconds); p.feedback = Float(feedback / 100)
        p.delayMix = Float(delayMix / 100); p.delayTone = Float(delayTone / 100)
        p.reverbEnabled = reverbEnabled ? 1 : 0; p.reverbHall = Int32(reverbStyle)
        p.reverbSize = Float(size / 100); p.preDelayMS = Float(preDelay)
        p.reverbMix = Float(reverbMix / 100); p.reverbTone = Float(reverbTone / 100)
        p.width = Float(width / 100); p.ducking = Float(ducking / 100)
        return p
    }
}

struct RigPreset: Codable, Identifiable, Equatable {
    var id = UUID().uuidString
    var name: String
    var modelFile: String
    var program: Int
    var input = 0.0
    var output = -12.0
    var gate = -70.0
    var reverb = 2.0
    var effects = RigEffectSettings()

    var valid: Bool {
        !name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && name.count <= 80 &&
        !modelFile.isEmpty && modelFile == (modelFile as NSString).lastPathComponent && modelFile.hasSuffix(".nam") &&
        (0...127).contains(program) && input.isFinite && (-24...24).contains(input) &&
        output.isFinite && (-60...6).contains(output) && gate.isFinite && (-85 ... -30).contains(gate) &&
        reverb.isFinite && (0...10).contains(reverb) && effects.valid
    }
}

extension RigPreset {
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id); name = try c.decode(String.self, forKey: .name)
        modelFile = try c.decode(String.self, forKey: .modelFile); program = try c.decode(Int.self, forKey: .program)
        input = try c.decode(Double.self, forKey: .input); output = try c.decode(Double.self, forKey: .output)
        gate = try c.decode(Double.self, forKey: .gate); reverb = try c.decode(Double.self, forKey: .reverb)
        // No migration write: pre-effects presets retain their exact sound until edited and saved.
        effects = try c.decodeIfPresent(RigEffectSettings.self, forKey: .effects) ?? RigEffectSettings()
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
