import Foundation
import CoreML

// Spotify Basic Pitch ICASSP 2022, unchanged Core ML weights. Our rolling-window
// adapter and live MIDI decoder are independent of the offline Python decoder.
final class GuitarDetector {
    static let sampleRate = 22050.0
    static let window = 43844
    static let hop = 1024 // four model frames, ~46.4 ms
    static let firstFrame = 153 // retain 15 frames of right context
    let model: MLModel
    let input: MLMultiArray
    var audio = [Float](repeating: 0, count: window)
    var pending: [Float] = []
    var tracker = NoteTracker()
    var samplesProcessed = 0
    var inferenceMS = 0.0
    var gateDB: Float = -60
    var threshold: Float = 0.5
    var send: (Int, Int) -> Void = { _, _ in } // velocity zero = note off

    init(url: URL) throws {
        let config = MLModelConfiguration()
        config.computeUnits = .cpuOnly // Initial baseline; the Fretwire comparison found .all faster on this Mac.
        let compiled = url.pathExtension == "mlmodelc" ? url : try MLModel.compileModel(at: url)
        model = try MLModel(contentsOf: compiled, configuration: config)
        input = try MLMultiArray(shape: [1, 43844, 1], dataType: .float32)
    }

    func reset() {
        tracker.reset(send: send)
        audio = [Float](repeating: 0, count: Self.window)
        pending.removeAll(keepingCapacity: true)
        samplesProcessed = 0
    }

    func append(_ samples: [Float]) throws {
        pending.append(contentsOf: samples)
        while pending.count >= Self.hop {
            audio.removeFirst(Self.hop)
            audio.append(contentsOf: pending.prefix(Self.hop))
            pending.removeFirst(Self.hop)
            samplesProcessed += Self.hop
            let pointer = input.dataPointer.assumingMemoryBound(to: Float.self)
            audio.withUnsafeBufferPointer { pointer.update(from: $0.baseAddress!, count: Self.window) }
            let start = CFAbsoluteTimeGetCurrent()
            let result = try model.prediction(from: MLDictionaryFeatureProvider(dictionary: ["input_2": input]))
            inferenceMS = (CFAbsoluteTimeGetCurrent() - start) * 1000
            guard let notes = result.featureValue(for: "Identity_1")?.multiArrayValue,
                  let onsets = result.featureValue(for: "Identity_2")?.multiArrayValue else {
                throw NSError(domain: "GuitarMIDI", code: 1, userInfo: [NSLocalizedDescriptionKey: "Basic Pitch returned an unexpected output"])
            }
            for frame in Self.firstFrame..<(Self.firstFrame + 4) {
                let begin = frame * 256
                let rms = sqrt(audio[begin..<(begin + 256)].reduce(Float(0)) { $0 + $1 * $1 } / 256)
                let audible = 20 * log10(max(rms, 1e-9)) >= gateDB
                let n = (38...88).map { notes[[0, NSNumber(value: frame), NSNumber(value: $0 - 21)]].floatValue }
                let o = (38...88).map { onsets[[0, NSNumber(value: frame), NSNumber(value: $0 - 21)]].floatValue }
                tracker.process(notes: n, onsets: o, audible: audible, threshold: threshold, send: send)
            }
        }
    }
}

struct NoteTracker {
    private(set) var active = Set<Int>()
    var weak = [Int](repeating: 0, count: 51)
    var strong = [Int](repeating: 0, count: 51)
    var lastOnset = [Float](repeating: 0, count: 51)
    var lastAttack = [Int](repeating: -100, count: 51)
    var frame = 0

    mutating func reset(send: (Int, Int) -> Void) {
        for note in active.sorted() { send(note, 0) }
        self = NoteTracker()
    }

    mutating func process(notes: [Float], onsets: [Float], audible: Bool, threshold: Float, send: (Int, Int) -> Void) {
        frame += 1
        for i in 0..<51 {
            let note = i + 38
            let confidence = audible ? notes[i] : 0
            let onset = audible ? onsets[i] : 0
            strong[i] = confidence >= threshold ? strong[i] + 1 : 0
            weak[i] = confidence < threshold * 0.6 ? weak[i] + 1 : 0
            let attack = onset >= threshold && lastOnset[i] < threshold * 0.6 && frame - lastAttack[i] >= 10
            if active.contains(note) && (weak[i] >= 3 || attack) {
                active.remove(note)
                send(note, 0)
            }
            if !active.contains(note) && confidence >= threshold * 0.6 && (attack || strong[i] >= 2) {
                active.insert(note)
                lastAttack[i] = frame
                // Model confidence is not performance velocity. Use a fixed velocity
                // until an amplitude calibration is measured on real guitar inputs.
                send(note, 96)
            }
            lastOnset[i] = onset
        }
    }
}
