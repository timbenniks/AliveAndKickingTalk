import Foundation
import SwiftUI
import Combine
import CoreMIDI

func runRigSelfTest() throws {
    try require(RigState.startupIssue(rigEnabled: false, inputAvailable: true, outputAvailable: false, modelAvailable: false) == nil,
                "Notes-only mode needs neither audio output nor a NAM capture")
    for enabled in [false, true] {
        try require(RigState.startupIssue(rigEnabled: enabled, inputAvailable: false, outputAvailable: true, modelAvailable: true) != nil,
                    "Both modes require a guitar input")
    }
    try require(RigState.startupIssue(rigEnabled: true, inputAvailable: true, outputAvailable: false, modelAvailable: true) != nil,
                "Built-in rig requires an output")
    try require(RigState.startupIssue(rigEnabled: true, inputAvailable: true, outputAvailable: true, modelAvailable: false) != nil,
                "Built-in rig requires a capture")
    try require(RigState.startupIssue(rigEnabled: true, inputAvailable: true, outputAvailable: true, modelAvailable: true) == nil,
                "Built-in rig accepts a complete route")
    print("PASS: rig and notes-only startup requirements")
    let folder = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
    defer { try? FileManager.default.removeItem(at: folder) }
    let store = RigPresetStore(url: folder.appendingPathComponent("presets.json"))
    let p = RigPreset(name: "Clean", modelFile: "clean.nam", program: 0)
    var q = RigPreset(name: "Lead", modelFile: "lead.nam", program: 127, input: 3, output: -6, gate: -55, reverb: 5)
    try store.save([p, q])
    let loaded = try store.load()
    try require(loaded == [p, q], "Saved presets round-trip all sound settings")
    q.program = 0
    do { try store.save([p, q]); throw NSError(domain: "Test", code: 1) }
    catch { let preserved = try store.load(); try require(preserved == loaded, "Duplicate MIDI mapping must not overwrite presets") }
    var invalid = p; invalid.modelFile = "../other.nam"
    try require(!invalid.valid, "Model path must stay in the selected folder")
    invalid = p; invalid.output = .nan
    try require(!invalid.valid, "Nonfinite gain rejected")
    var parser = ProgramParser()
    try require(parser.feed([0xC0, 0, 127, 0xF8, 3, 0xC1, 9, 0x90, 60, 96, 0xC0]) == [0, 127, 3], "Channel filtering, running status and realtime MIDI")
    try require(parser.feed([4, 0xF0, 1, 2, 0xF7, 7, 0xC0, 5]) == [4, 5], "Split packet and SysEx handling")

    // Real CoreMIDI destination loopback, without opening an audio interface.
    let port = try AmpMIDIPort()
    var received: [Int] = []
    port.received = { received.append($0) }
    var client = MIDIClientRef(), output = MIDIPortRef()
    try check(MIDIClientCreateWithBlock("Alive preview self test" as CFString, &client, nil), "Test client")
    defer { MIDIPortDispose(output); MIDIClientDispose(client) }
    try check(MIDIOutputPortCreate(client, "Test output" as CFString, &output), "Test output")
    var list = MIDIPacketList()
    let bytes: [UInt8] = [0xC0, 0, 0xC0, 127]
    let result = withUnsafeMutablePointer(to: &list) { pointer -> OSStatus in
        let packet = MIDIPacketListInit(pointer)
        return bytes.withUnsafeBufferPointer {
            let next = MIDIPacketListAdd(pointer, MemoryLayout<MIDIPacketList>.size, packet, 0, 2, $0.baseAddress!)
            _ = MIDIPacketListAdd(pointer, MemoryLayout<MIDIPacketList>.size, next, 0, 2, $0.baseAddress!.advanced(by: 2))
            return MIDISend(output, port.destination, pointer)
        }
    }
    try check(result, "Send program changes")
    let end = Date().addingTimeInterval(2)
    while received.count < 2 && Date() < end { RunLoop.current.run(until: Date().addingTimeInterval(0.01)) }
    try require(received == [0, 127], "Real CoreMIDI amp control delivers programs zero and 127")
    print("PASS: preset persistence/validation and real amp-control MIDI loopback")
}

func runCombinedRigTest(modelPath: String) throws {
    guard let url = Bundle.main.url(forResource: "nmp", withExtension: "mlmodelc") else { throw NSError(domain: "Test", code: 1) }
    let session = RigSession()
    defer { session.stop() }
    let lock = NSLock()
    var heard = Set<Int>(), lastNotes: [Int] = [], reports = 0
    var errors: [String] = []
    session.report = { notes, _, _, _, _, _ in
        lock.lock(); heard.formUnion(notes); lastNotes = notes; reports += 1; lock.unlock()
    }
    session.detectionFailed = { error in lock.lock(); errors.append(error); lock.unlock() }
    session.loadFinished = { _, error in if let error { lock.lock(); errors.append(error); lock.unlock() } }
    try session.start(input: "", output: "", channel: 0, block: 128, modelURL: url,
                      gate: -60, threshold: 0.5, timing: DetectorTiming(), compute: .automatic, offline: true)
    let model = URL(fileURLWithPath: modelPath)
    let preset = RigPreset(name: "Offline test", modelFile: model.lastPathComponent, program: 0)
    session.load(preset, directory: model.deletingLastPathComponent(), generation: 1)
    var left = [Float](repeating: 0, count: 512), right = left
    var energy = 0.0, maxMS = 0.0
    for block in 0..<450 {
        if block == 190 { session.load(preset, directory: model.deletingLastPathComponent(), generation: 2) }
        let input = (0..<512).map { i -> Float in
            let t = Double(block * 512 + i) / 48000
            let pitches = t >= 0.4 && t < 1.2 ? [45] : t >= 1.7 && t < 3.2 ? [40,47,52,56,59,64] : []
            let age = t - (t < 1.7 ? 0.4 : 1.7)
            var sample = 0.0
            for pitch in pitches {
                let freq = 440 * pow(2, Double(pitch - 69) / 12)
                for h in 1...8 { sample += sin(2 * .pi * freq * Double(h) * age) / pow(Double(h), 1.3) * 0.06 * min(1, age / 0.008) * exp(-age * 1.2) }
            }
            return Float(sample)
        }
        input.withUnsafeBufferPointer { rig_render(session.pointer, $0.baseAddress!, &left, &right, 512) }
        for x in left { try require(x.isFinite && abs(x) <= 0.9, "Combined output must remain finite and limited"); energy += Double(x*x) }
        maxMS = max(maxMS, rig_callback_ms(session.pointer))
        RunLoop.current.run(until: Date().addingTimeInterval(0.011))
    }
    RunLoop.current.run(until: Date().addingTimeInterval(0.1))
    lock.lock(); let result = (heard, lastNotes, reports, errors); lock.unlock()
    try require(result.3.isEmpty, "Combined path failed: \(result.3)")
    try require(Set([45,40,47,52,56,59,64]).isSubset(of: result.0), "Combined path missed notes: \(result.0.sorted())")
    try require(result.1.isEmpty && result.2 > 0, "Combined detector must release notes after silence")
    try require(energy > 0 && rig_active_generation(session.pointer) == 2 && rig_fault(session.pointer) == 0, "Amp must produce audio and complete the preset switch")
    try require(rig_dropped(session.pointer) == 0, "Combined path dropped DI audio")
    print("PASS: simultaneous NAM + 48k DI queue + resampling + Core ML, preset switch, note release; found \(result.0.sorted()), \(result.2) reports, zero drops")
    print(String(format: "Offline 512-sample amp callback max %.3f ms; excludes hardware and is not a round-trip latency measurement", maxMS))
}

// Render the production monitor without opening an interface or sending notes.
@MainActor
func runRigDisplayTest() throws {
    let state = RigState()
    var shellUpdates = 0, displayUpdates = 0
    let shell = state.objectWillChange.sink { shellUpdates += 1 }
    let display = state.live.objectWillChange.sink { displayUpdates += 1 }
    defer { shell.cancel(); display.cancel() }
    for i in 0..<300 {
        state.live.update(pitches: [], inference: Double(i), inputDB: -Float(i % 120), dropped: i, now: Double(i) / 1000)
    }
    try require(displayUpdates <= 10 && displayUpdates > 0, "Repeated meter updates must be limited to 30 Hz")
    state.live.update(pitches: [40], inference: 2, inputDB: -30, dropped: 0, now: 0.300)
    state.live.update(pitches: [], inference: 2, inputDB: -30, dropped: 0, now: 0.301)
    try require(state.live.readings.pitches.isEmpty, "Note releases must bypass the meter throttle")
    state.live.update(pitches: [45], inference: 2, inputDB: -30, dropped: 0, now: 0.302)
    try require(state.live.readings.pitches == [45], "Note attacks must bypass the meter throttle")
    let patterns = [[], [45], [40, 47, 52, 56, 59, 64], Array(40...52), Array(40...88)]
    for width: CGFloat in [440, 580, 760] {
        var expected: CGSize?
        for (index, notes) in patterns.enumerated() {
            state.live.update(pitches: notes, inference: index == 4 ? 9999 : 2.5, inputDB: -Float(index * 25), dropped: index == 4 ? 999999 : 0, now: Double(index + 1))
            let renderer = ImageRenderer(content: RigNoteMonitor(live: state.live)
                .font(RigStyle.body()).foregroundStyle(RigStyle.bone).preferredColorScheme(.dark).frame(width: width))
            guard let image = renderer.nsImage else { throw NSError(domain: "DisplayTest", code: 1, userInfo: [NSLocalizedDescriptionKey: "Could not render the note monitor"]) }
            if let expected { try require(image.size == expected, "Notes and meter digit changes must not change monitor size") }
            expected = image.size
            try require(image.size == CGSize(width: width, height: 266), "Monitor has a fixed height at every supported pane width")
            if width == 580 && index == 2, let data = image.tiffRepresentation,
               let bitmap = NSBitmapImageRep(data: data), let png = bitmap.representation(using: .png, properties: [:]) {
                try png.write(to: URL(fileURLWithPath: "/tmp/alive-rig-note-monitor.png"))
            }
        }
    }
    state.live.reset()
    try require(state.live.readings == RigReadings(), "Stopping clears all live readings")
    try require(shellUpdates == 0, "Live reports must not invalidate RigState or the app shell")
    print("PASS: 30 Hz meters, immediate note attacks/releases, zero shell invalidations, stable monitor geometry for 0/1/6/13/49 notes at three widths")
}
