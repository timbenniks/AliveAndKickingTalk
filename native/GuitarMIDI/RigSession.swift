import Foundation
import AVFoundation

final class RigSession {
    let pointer: UnsafeMutableRawPointer
    let worker = DispatchQueue(label: "alive.preview.detector", qos: .userInitiated)
    let loader = DispatchQueue(label: "alive.preview.models", qos: .userInitiated)
    var timer: DispatchSourceTimer?
    var detector: GuitarDetector?
    var midi: GuitarMIDIPort?
    var stopped = false
    var report: (([Int], Double, Float, Int, UInt64, Double) -> Void)?
    var detectionFailed: ((String) -> Void)?
    var loadFinished: ((UInt64, String?) -> Void)?
    var lastDrop: UInt64 = 0

    init() { pointer = rig_create()! }
    func start(input: String, output: String, channel: Int, block: Int, modelURL: URL,
               gate: Float, threshold: Float, timing: DetectorTiming, compute: DetectorCompute, offline: Bool = false) throws {
        let d = try GuitarDetector(url: modelURL, timing: timing, compute: compute)
        d.gateDB = gate; d.threshold = threshold
        let port = try GuitarMIDIPort(name: "Alive Rig Preview Notes")
        d.send = { [weak port] note, velocity in port?.send(note, velocity) }
        detector = d; midi = port
        guard let source = AVAudioFormat(commonFormat: .pcmFormatFloat32, sampleRate: 48000, channels: 1, interleaved: false),
              let target = AVAudioFormat(commonFormat: .pcmFormatFloat32, sampleRate: GuitarDetector.sampleRate, channels: 1, interleaved: false),
              let converter = AVAudioConverter(from: source, to: target),
              let inputBuffer = AVAudioPCMBuffer(pcmFormat: source, frameCapacity: 4096),
              let converted = AVAudioPCMBuffer(pcmFormat: target, frameCapacity: 2048) else {
            throw NSError(domain: "Rig", code: 1, userInfo: [NSLocalizedDescriptionKey: "Cannot create the note detector's audio converter."])
        }
        var error = [CChar](repeating: 0, count: 1024)
        guard offline || rig_start(pointer, input, output, Int32(channel), Int32(block), &error, 1024) != 0 else {
            throw NSError(domain: "Rig", code: 2, userInfo: [NSLocalizedDescriptionKey: String(cString: error)])
        }
        let timer = DispatchSource.makeTimerSource(queue: worker)
        timer.schedule(deadline: .now(), repeating: .milliseconds(10))
        timer.setEventHandler { [weak self] in
            guard let self else { return }
            rig_collect(self.pointer)
            guard let detector = self.detector else { return }
            let dropped = rig_dropped(self.pointer)
            if dropped != self.lastDrop {
                self.lastDrop = dropped
                detector.reset(); converter.reset()
                // Throw away stale audio after a discontinuity; never replay a backlog.
                while rig_read(self.pointer, inputBuffer.floatChannelData![0], 4096) > 0 {}
            }
            let count = rig_read(self.pointer, inputBuffer.floatChannelData![0], 4096)
            guard count > 0 else { return }
            inputBuffer.frameLength = AVAudioFrameCount(count)
            var supplied = false
            var failure: NSError?
            let result = converter.convert(to: converted, error: &failure) { _, status in
                if supplied { status.pointee = .noDataNow; return nil }
                supplied = true; status.pointee = .haveData; return inputBuffer
            }
            do {
                if result == .error { throw failure ?? NSError(domain: "Rig", code: 3) }
                let samples = Array(UnsafeBufferPointer(start: converted.floatChannelData![0], count: Int(converted.frameLength)))
                try detector.append(samples)
                let rms = sqrt(samples.reduce(Float(0)) { $0 + $1 * $1 } / Float(max(1, samples.count)))
                self.report?(detector.tracker.active.sorted(), detector.inferenceMS, 20 * log10(max(rms, 1e-9)), Int(dropped), rig_active_generation(self.pointer), rig_callback_ms(self.pointer))
            } catch {
                detector.reset(); self.midi?.panic(); self.detector = nil
                self.detectionFailed?("Note detection stopped: \(error.localizedDescription). The amp is still running.")
            }
        }
        self.timer = timer; timer.resume()
    }
    func load(_ preset: RigPreset, directory: URL, generation: UInt64) {
        rig_request(pointer, generation)
        loader.async { [weak self] in
            guard let self else { return }
            var error = [CChar](repeating: 0, count: 1024)
            let result = rig_load(self.pointer, directory.appendingPathComponent(preset.modelFile).path, generation,
                                  Float(preset.input), Float(preset.output), Float(preset.gate), Float(preset.reverb), &error, 1024)
            if result != 2 { self.loadFinished?(generation, result == 0 ? String(cString: error) : nil) }
        }
    }
    func controls(_ preset: RigPreset, muted: Bool) {
        rig_controls(pointer, Float(preset.input), Float(preset.output), Float(preset.gate), Float(preset.reverb), muted ? 1 : 0)
    }
    func stop() {
        guard !stopped else { return }; stopped = true
        rig_stop(pointer)
        timer?.cancel(); timer = nil
        loader.sync {}
        worker.sync { detector?.reset(); midi?.panic(); detector = nil; midi = nil; rig_collect(pointer) }
    }
    deinit { stop(); rig_destroy(pointer) }
}
