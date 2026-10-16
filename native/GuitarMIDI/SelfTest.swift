import Foundation
import CoreMIDI

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
    let detector = try GuitarDetector(url: url)
    var currentTime = 0.0
    var detected: [(Double, Int, Int)] = []
    var timings: [Double] = []
    detector.send = { detected.append((currentTime, $0, $1)) }
    // Deterministic plucked harmonic signals; not a substitute for DI recordings.
    let phrases: [(Double, Double, [Int])] = [(0.4,0.9,[45]), (1.3,1.8,[52]), (2.2,3.0,[45,52,57]), (3.5,4.2,[40,47,52,56,59,64])]
    for block in 0..<112 {
        let samples: [Float] = (0..<GuitarDetector.hop).map { offset in
            let time = Double(block * GuitarDetector.hop + offset) / GuitarDetector.sampleRate
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
        currentTime = Double((block + 1) * GuitarDetector.hop) / GuitarDetector.sampleRate
        try detector.append(samples)
        timings.append(detector.inferenceMS)
    }
    for (time,note,velocity) in detected { print(String(format: "%.3f %@ %d", time, velocity > 0 ? "on" : "off", note)) }
    let ordered = timings.sorted()
    print(String(format: "CoreML median %.2f ms, p95 %.2f ms", ordered[ordered.count / 2], ordered[Int(Double(ordered.count) * 0.95)]))
    for (start,end,chord) in phrases {
        let heard = Set(detected.filter { $0.0 >= start && $0.0 < end + 0.35 && $0.2 > 0 }.map { $0.1 })
        let first = detected.first { $0.0 >= start && $0.0 < end + 0.35 && chord.contains($0.1) && $0.2 > 0 }
        print("Phrase \(chord): found \(heard.sorted()), first note delay \(first.map { Int(($0.0 - start) * 1000) } ?? -1) ms (audio time, excludes CPU/device/browser)")
        try require(Set(chord).isSubset(of: heard), "Model missed expected pitches in the synthetic phrase \(chord)")
    }
    try require(detector.tracker.active.isEmpty, "Silence must release actual model notes")
    print("PASS: bundled weights detect synthetic riffs/chords and return to silence")
}
