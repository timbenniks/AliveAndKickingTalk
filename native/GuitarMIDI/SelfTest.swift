import Foundation
import CoreMIDI
import AVFoundation

// Explicit hardware check, separate from the microphone-free --self-test.
// Uses the production capture/conversion/model path and retains no audio.
func runInputTest(arguments: [String]) throws {
    guard arguments.count == 2, let channel = Int(arguments[1]), channel > 0,
          let device = inputDevices().first(where: { $0.name == arguments[0] }),
          let url = Bundle.main.url(forResource: "nmp", withExtension: "mlmodelc") else {
        throw NSError(domain: "GuitarMIDITest", code: 2, userInfo: [NSLocalizedDescriptionKey: "Use --input-test 'Exact device name' channel-number"])
    }
    try require(AVCaptureDevice.authorizationStatus(for: .audio) == .authorized, "Allow microphone access in the app before running the hardware test")
    let capture = GuitarCapture()
    defer { capture.stop() }
    let lock = NSLock()
    var reports = 0, highestDB: Float = -180
    var failure: String?
    capture.report = { _, _, db, _ in
        lock.lock(); reports += 1; highestDB = max(highestDB, db); lock.unlock()
    }
    capture.failed = { message in lock.lock(); failure = message; lock.unlock() }
    try capture.start(device: device.id, channel: channel - 1, modelURL: url, gate: -60, threshold: 0.5, timing: DetectorTiming(), compute: .automatic)
    RunLoop.current.run(until: Date().addingTimeInterval(3))
    let processed = capture.worker.sync { capture.detector?.samplesProcessed ?? 0 }
    capture.stop()
    lock.lock(); let result = (reports, highestDB, failure); lock.unlock()
    try require(result.2 == nil, result.2 ?? "Capture failed")
    try require(result.0 > 0 && processed > 0, "No audio reached the detector")
    print("PASS: \(device.name), channel \(channel), \(result.0) audio reports, \(processed) model input samples, peak buffer RMS \(result.1) dBFS")
}

func require(_ condition: @autoclosure () -> Bool, _ message: String) throws {
    if !condition() { throw NSError(domain: "GuitarMIDITest", code: 1, userInfo: [NSLocalizedDescriptionKey: message]) }
}

func runSelfTest() throws {
    var events: [(Int, Int)] = []
    let send: (Int, Int) -> Void = { events.append(($0, $1)) }
    var tracker = NoteTracker()
    var notes = [Float](repeating: 0, count: 51)
    var onsets = notes
    for note in [40, 47, 52, 56, 59, 64] { notes[note - 38] = 0.9; onsets[note - 38] = 0.8 }
    tracker.process(notes: notes, onsets: onsets, audible: true, threshold: 0.5, send: send)
    try require(tracker.active == Set([40, 47, 52, 56, 59, 64]), "Six-note chord was not emitted")
    for _ in 0..<12 { tracker.process(notes: notes, onsets: Array(repeating: 0, count: 51), audible: true, threshold: 0.5, send: send) }
    try require(events.count == 6, "Sustained chord retriggered")
    tracker.process(notes: notes, onsets: onsets, audible: true, threshold: 0.5, send: send)
    try require(events.count == 18, "Repeated strum must release and retrigger each note")
    for _ in 0..<25 { tracker.process(notes: notes, onsets: onsets, audible: true, threshold: 0.5, send: send) }
    try require(events.count == 18, "One broad onset must not retrigger held notes")
    for _ in 0..<3 { tracker.process(notes: notes, onsets: onsets, audible: false, threshold: 0.5, send: send) }
    try require(tracker.active.isEmpty && events.count == 24, "Gate must release all notes")
    tracker.reset(send: send)

    // Exercise the actual CoreMIDI virtual source and receive bytes on a port.
    let port = try GuitarMIDIPort()
    var client = MIDIClientRef(), input = MIDIPortRef()
    let received = DispatchSemaphore(value: 0)
    let lock = NSLock()
    var messages: [[UInt8]] = []
    try check(MIDIClientCreateWithBlock("Alive self-test" as CFString, &client, nil), "Test MIDI client")
    defer { if input != 0 { MIDIPortDispose(input) }; MIDIClientDispose(client) }
    try check(MIDIInputPortCreateWithBlock(client, "Test input" as CFString, &input) { list, _ in
        var packet = UnsafeRawPointer(list).advanced(by: MemoryLayout<MIDIPacketList>.offset(of: \.packet)!).assumingMemoryBound(to: MIDIPacket.self)
        for _ in 0..<list.pointee.numPackets {
            let bytes = withUnsafeBytes(of: packet.pointee.data) { Array($0.prefix(Int(packet.pointee.length))) }
            lock.lock(); messages.append(bytes); lock.unlock()
            received.signal()
            packet = UnsafePointer(MIDIPacketNext(packet))
        }
    }, "Test MIDI input")
    try check(MIDIPortConnectSource(input, port.source, nil), "Test MIDI connection")
    RunLoop.current.run(until: Date().addingTimeInterval(0.1))
    for note in [40, 47, 52] { try check(port.send(note, 96), "Test note on") }
    for note in [40, 47, 52] { try check(port.send(note, 0), "Test note off") }
    let deadline = Date().addingTimeInterval(2)
    while Date() < deadline {
        lock.lock(); let count = messages.flatMap { $0 }.count; lock.unlock()
        if count >= 18 { break }
        _ = received.wait(timeout: .now() + 0.05)
    }
    lock.lock(); let delivered = messages; lock.unlock()
    try require(delivered.flatMap { $0 } == [0x90,40,96,0x90,47,96,0x90,52,96,0x80,40,0,0x80,47,0,0x80,52,0], "Virtual MIDI bytes differ: \(delivered)")
    print("PASS: chord state, repeated strums, release, and actual CoreMIDI loopback")

    guard let url = Bundle.main.url(forResource: "nmp", withExtension: "mlmodelc") else { throw NSError(domain: "test", code: 2) }
    // Every supported interval advances by exactly the frames it emits, including
    // the shortest/longest custom settings. Settings are immutable during capture.
    for lookahead in 2...20 {
        for interval in 1...8 {
            let timing = DetectorTiming(lookaheadFrames: lookahead, intervalFrames: interval)
            try require(timing.frames.count * 256 == timing.hop, "Frame count differs from window advance")
            let previousEnd = timing.frames.upperBound * 256
            let nextStart = timing.hop + timing.frames.lowerBound * 256
            try require(previousEnd == nextStart && timing.frames.lowerBound >= 0 && previousEnd <= GuitarDetector.window, "Decoded frames overlap or skip audio")
        }
    }
    try require(TimingPreset.accurate.timing.frames == 153..<157, "Accurate must preserve original context")
    try require(DetectorTiming(lookaheadFrames: 2, intervalFrames: 8).presetName == "Custom", "Custom settings mislabeled")
    let configurations: [(String, DetectorTiming, DetectorCompute)] = TimingPreset.allCases.map {
        ($0.rawValue, $0.timing, .automatic)
    } + [("Original CPU baseline", TimingPreset.accurate.timing, .cpu)]
    for (name, timing, compute) in configurations {
        print("Testing \(name), \(compute.rawValue)")
        let detector = try GuitarDetector(url: url, timing: timing, compute: compute)
        var currentTime = 0.0
        var detected: [(Double, Int, Int)] = []
        var timings: [Double] = []
        detector.send = { detected.append((currentTime, $0, $1)) }
        // Deterministic plucked harmonic signals; not a substitute for DI recordings.
        let phrases: [(Double, Double, [Int])] = [(0.4,0.9,[45]), (1.3,1.8,[52]), (2.2,3.0,[45,52,57]), (3.5,4.2,[40,47,52,56,59,64])]
        for block in 0..<Int(ceil(5.2 * GuitarDetector.sampleRate / Double(timing.hop))) {
            let samples: [Float] = (0..<timing.hop).map { offset in
                let time = Double(block * timing.hop + offset) / GuitarDetector.sampleRate
                var sample = 0.0
                for (start,end,chord) in phrases where time >= start && time < end {
                    let age = time - start
                    for note in chord {
                        let freq = 440 * pow(2, Double(note - 69) / 12)
                        for h in 1...8 { sample += sin(2 * .pi * freq * Double(h) * age) / pow(Double(h), 1.3) * 0.06 * min(1, age / 0.008) * exp(-age * 1.2) }
                    }
                }
                return Float(sample)
            }
            currentTime = Double((block + 1) * timing.hop) / GuitarDetector.sampleRate
            // Deliberately split capture chunks off the model frame boundary.
            try detector.append(Array(samples.prefix(17)))
            try require(detector.samplesProcessed == block * timing.hop, "Partial hop inferred too soon")
            try detector.append(Array(samples.dropFirst(17)))
            try require(detector.pending.isEmpty && detector.samplesProcessed == (block + 1) * timing.hop, "Capture chunk remainder lost")
            try require(detector.tracker.frame == (block + 1) * timing.intervalFrames, "Frames replayed or skipped")
            timings.append(detector.inferenceMS)
        }
        let ordered = timings.sorted()
        print(String(format: "CoreML median %.2f ms, p95 %.2f ms", ordered[ordered.count / 2], ordered[Int(Double(ordered.count) * 0.95)]))
        for (start,end,chord) in phrases {
            let heard = Set(detected.filter { $0.0 >= start && $0.0 < end + 0.35 && $0.2 > 0 }.map { $0.1 })
            let first = detected.first { $0.0 >= start && $0.0 < end + 0.35 && chord.contains($0.1) && $0.2 > 0 }
            print("Phrase \(chord): found \(heard.sorted()), first note delay \(first.map { Int(($0.0 - start) * 1000) } ?? -1) ms (audio time, excludes CPU/device/browser)")
            try require(Set(chord).isSubset(of: heard), "Model missed expected pitches in the synthetic phrase \(chord)")
        }
        try require(detector.tracker.active.isEmpty, "Silence must release actual model notes")
        try detector.append([0.1, 0.2, 0.3])
        detector.tracker.process(notes: notes, onsets: onsets, audible: true, threshold: 0.5, send: detector.send)
        let beforeReset = detected.count
        detector.reset()
        try require(detected.count == beforeReset + 6 && detected.suffix(6).allSatisfy { $0.2 == 0 }, "Reset failed to release held chord")
        try require(detector.pending.isEmpty && detector.samplesProcessed == 0 && detector.tracker.frame == 0 && detector.audio.allSatisfy { $0 == 0 }, "Reset retained audio or tracking state")
        print("PASS: \(name) model riffs/chords, silence, split capture chunks and reset")
    }
    // Exercise custom boundary settings with actual inference, including several
    // predictions in one append and a final partial hop.
    for timing in [DetectorTiming(lookaheadFrames: 2, intervalFrames: 1), DetectorTiming(lookaheadFrames: 20, intervalFrames: 8)] {
        let detector = try GuitarDetector(url: url, timing: timing)
        try detector.append(Array(repeating: 0, count: timing.hop * 3 + 17))
        try require(detector.tracker.frame == timing.intervalFrames * 3 && detector.pending.count == 17 && detector.tracker.active.isEmpty, "Custom boundary scheduling failed")
    }
    print("PASS: all timing ranges, custom boundaries and CPU fallback")
}
