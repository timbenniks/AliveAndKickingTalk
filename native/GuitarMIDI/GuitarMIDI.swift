import SwiftUI
import AVFoundation

func noteName(_ note: Int) -> String {
    let names = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"]
    return "\(names[note % 12])\(note / 12 - 1)"
}

final class GuitarState: ObservableObject {
    @Published var devices = inputDevices()
    @Published var device: AudioDeviceID = 0
    @Published var channel = 0
    @Published var gate = -60.0
    @Published var threshold = 0.5
    @Published var running = false
    @Published var starting = false
    @Published var status = "Choose your clean guitar input."
    @Published var notes = "—"
    @Published var inference = 0.0
    @Published var inputDB: Float = -120
    @Published var dropped = 0
    var capture: GuitarCapture?
    var generation = 0
    var watchdog: Timer?
    var lastAudio = Date()
    var termination: NSObjectProtocol?

    init() {
        termination = NotificationCenter.default.addObserver(forName: NSApplication.willTerminateNotification, object: nil, queue: .main) { [weak self] _ in self?.stop() }
    }
    var channelCount: Int { devices.first(where: { $0.id == device })?.channels ?? 2 }
    func start() {
        stop()
        starting = true
        let request = generation
        status = "Requesting microphone access…"
        AVCaptureDevice.requestAccess(for: .audio) { [weak self] allowed in
            DispatchQueue.main.async { [weak self] in
                guard let self, request == self.generation else { return }
                guard allowed else { self.starting = false; self.status = "Allow microphone access in System Settings → Privacy & Security → Microphone."; return }
                guard let url = Bundle.main.url(forResource: "nmp", withExtension: "mlmodelc") else {
                    self.starting = false; self.status = "The Basic Pitch model is missing. Rebuild the app."; return
                }
                let capture = GuitarCapture()
                self.capture = capture
                capture.report = { [weak self] notes, ms, db, dropped in
                    DispatchQueue.main.async {
                        guard let self, self.generation == request else { return }
                        self.notes = notes.isEmpty ? "—" : notes.map(noteName).joined(separator: " · ")
                        self.lastAudio = Date()
                        self.inference = ms; self.inputDB = db; self.dropped = dropped
                    }
                }
                capture.failed = { [weak self] message in
                    DispatchQueue.main.async {
                        guard let self, self.generation == request else { return }
                        self.stop(); self.status = message
                    }
                }
                do {
                    try capture.start(device: self.device, channel: self.channel, modelURL: url, gate: Float(self.gate), threshold: Float(self.threshold))
                    self.lastAudio = Date()
                    self.watchdog = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { [weak self] _ in
                        guard let self, self.running, Date().timeIntervalSince(self.lastAudio) > 2 else { return }
                        self.stop(); self.status = "Audio input stopped delivering samples. Reconnect and start again."
                    }
                    self.running = true
                    self.starting = false
                    self.status = "Sending notes to Alive Guitar MIDI"
                } catch { self.stop(); self.status = error.localizedDescription }
            }
        }
    }
    func stop() {
        generation += 1
        watchdog?.invalidate(); watchdog = nil
        capture?.stop(); capture = nil
        running = false; starting = false; notes = "—"; inputDB = -120
        status = "Stopped. All notes released."
    }
}

struct GuitarView: View {
    @StateObject var state = GuitarState()
    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Alive Guitar MIDI").font(.largeTitle.bold())
            Text("Chords & riffs · Basic Pitch ML preview").foregroundStyle(.secondary)
            Form {
                Picker("Guitar input", selection: $state.device) {
                    Text("System default input").tag(AudioDeviceID(0))
                    ForEach(state.devices) { Text($0.name).tag($0.id) }
                }
                .onChange(of: state.device) { _, _ in state.channel = 0 }
                Picker("Input channel", selection: $state.channel) {
                    ForEach(0..<state.channelCount, id: \.self) { Text("Channel \($0 + 1)").tag($0) }
                }
                HStack {
                    Text("Noise gate \(Int(state.gate)) dB")
                    Slider(value: $state.gate, in: -85 ... -30, step: 1)
                }
                HStack {
                    Text("Confidence \(state.threshold, specifier: "%.2f")")
                    Slider(value: $state.threshold, in: 0.25 ... 0.8, step: 0.05)
                }
            }.disabled(state.running || state.starting)
            HStack {
                Button(state.running || state.starting ? "Stop / release notes" : "Start listening") {
                    if state.running || state.starting { state.stop() } else { state.start() }
                }.keyboardShortcut(.space, modifiers: [])
                Button("Refresh inputs") { state.devices = inputDevices(); if !state.devices.contains(where: { $0.id == state.device }) { state.device = 0 } }.disabled(state.running || state.starting)
            }
            Text(state.notes).font(.title2.monospaced()).frame(minHeight: 44)
            Text(state.status).font(.callout)
            Text("Input \(Int(state.inputDB)) dB · inference \(state.inference, specifier: "%.1f") ms · dropped buffers \(state.dropped)").font(.caption.monospaced()).foregroundStyle(.secondary)
            Divider()
            Text("In the website: Rig → Neck follows → Guitar MIDI → Alive Guitar MIDI.")
            Text("Experimental: expect roughly 200–300 ms note delay. Inference time above is only one part of it. Use clean DI before amp effects. Audio stays on this Mac; this app does not monitor it through speakers.").font(.callout).foregroundStyle(.secondary).fixedSize(horizontal: false, vertical: true)
            Text("Stop before changing settings. Lower confidence for missed notes; raise it for extra notes. MIDI velocity is fixed; bends and string positions are not inferred.").font(.caption).foregroundStyle(.secondary).fixedSize(horizontal: false, vertical: true)
        }.padding(24).frame(width: 560)
        .onDisappear { state.stop() }
    }
}

@main
struct GuitarMIDIApp: App {
    init() {
        if CommandLine.arguments.contains("--self-test") {
            do { try runSelfTest(); exit(0) }
            catch { fputs("Self-test failed: \(error)\n", stderr); exit(1) }
        }
    }
    var body: some Scene {
        Window("Alive Guitar MIDI", id: "main") { GuitarView() }
            .windowResizability(.contentSize)
    }
}
