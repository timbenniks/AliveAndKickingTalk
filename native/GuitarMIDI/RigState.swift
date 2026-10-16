import SwiftUI
import AVFoundation

final class RigState: ObservableObject {
    @Published var devices = inputDevices()
    @Published var outputs = inputDevices(scope: kAudioDevicePropertyScopeOutput)
    @Published var device: AudioDeviceID = 0
    @Published var output: AudioDeviceID = 0
    @Published var channel = 0
    @Published var buffer = 128
    @Published var gate = -60.0
    @Published var threshold = 0.5
    @Published var timing = DetectorTiming()
    @Published var compute = DetectorCompute.automatic
    @Published var running = false
    @Published var starting = false
    @Published private(set) var rigEnabled = true
    @Published var status = "Choose your guitar input and headphone output."
    @Published var notes = "—"
    @Published var pitches: [Int] = []
    @Published var inference = 0.0
    @Published var inputDB: Float = -120
    @Published var dropped = 0
    @Published var audioMS = 0.0
    @Published var actualBuffer = 0
    @Published var captures: [AmpCapture] = []
    @Published var presets: [RigPreset] = []
    @Published var selected = ""
    @Published var draft = RigPreset(name: "My sound", modelFile: "", program: 0)
    @Published var loading = false
    @Published var muted = false { didSet { if let session { rig_mute(session.pointer, muted ? 1 : 0) } } }
    @Published var activeName = "No amp loaded"
    @Published var presetStatus = ""
    @Published var midiStatus = ""
    @Published var modelsDirectory = FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent("Music/Tims Amp/Models/Amps/Deluxe Reverb")
    let store = RigPresetStore()
    var storeReadable = true
    var session: RigSession?
    var noteCapture: GuitarCapture?
    var ampMIDI: AmpMIDIPort?
    var generation = 0
    var soundGeneration: UInt64 = 0
    var pendingSound: RigPreset?
    var monitor: Timer?
    var termination: NSObjectProtocol?
    var lastCallbacks: UInt64 = 0
    var lastAudio = Date()

    init() {
        do {
            if let url = Bundle.main.url(forResource: "deluxe-reverb-presets", withExtension: "json") {
                captures = try JSONDecoder().decode(AmpCatalog.self, from: Data(contentsOf: url)).presets
            }
            presets = try store.load()
            if presets.isEmpty {
                presets = captures.enumerated().map { i, c in
                    RigPreset(id: c.id, name: c.displayName, modelFile: c.modelFile, program: i, reverb: c.reverbAmount ?? 2)
                }
            }
        } catch { storeReadable = false; presetStatus = "Could not read presets: \(error.localizedDescription). Your file has been preserved." }
        let settings = UserDefaults.standard
        if let enabled = settings.object(forKey: "rigEnabled") as? Bool { rigEnabled = enabled }
        device = devices.first(where: { $0.name == settings.string(forKey: "input") })?.id ?? 0
        output = outputs.first(where: { $0.name == settings.string(forKey: "output") })?.id ?? 0
        channel = max(0, min(settings.integer(forKey: "channel"), channelCount - 1))
        if let path = settings.string(forKey: "modelsDirectory") { modelsDirectory = URL(fileURLWithPath: path) }
        if let v = settings.object(forKey: "noteGate") as? Double, (-85 ... -30).contains(v) { gate = v }
        if let v = settings.object(forKey: "confidence") as? Double, (0.25...0.8).contains(v) { threshold = v }
        let lookahead = settings.integer(forKey: "lookahead"), interval = settings.integer(forKey: "interval")
        if (2...20).contains(lookahead), (1...8).contains(interval) { timing = DetectorTiming(lookaheadFrames: lookahead, intervalFrames: interval) }
        if let value = settings.string(forKey: "compute"), let c = DetectorCompute(rawValue: value) { compute = c }
        let b = settings.integer(forKey: "buffer"); if [64, 128, 256].contains(b) { buffer = b }
        if let p = presets.first(where: { $0.id == settings.string(forKey: "preset") }) ?? presets.first {
            selected = p.id; draft = p
        }
        do {
            ampMIDI = try AmpMIDIPort()
            ampMIDI?.received = { [weak self] program in
                guard let self else { return }
                guard self.rigEnabled else { self.midiStatus = "Rig off · send amp changes to Neural DSP through IAC."; return }
                guard let preset = self.presets.first(where: { $0.program == program }) else {
                    self.midiStatus = "Program \(program) has no saved preset."; return
                }
                self.midiStatus = "Channel 1 · Program \(program) → \(preset.name)"
                self.selectPreset(preset.id)
            }
            midiStatus = rigEnabled ? "Listening: Alive Rig Preview Control · channel 1" : "Rig off · send amp changes to Neural DSP through IAC."
        } catch { midiStatus = error.localizedDescription }
        if !rigEnabled { status = "Notes only. Use Neural DSP for your amp sound." }
        termination = NotificationCenter.default.addObserver(forName: NSApplication.willTerminateNotification, object: nil, queue: .main) { [weak self] _ in self?.stop() }
    }
    var channelCount: Int { devices.first(where: { $0.id == device })?.channels ?? 1 }
    var dirty: Bool { presets.first(where: { $0.id == selected }) != draft }
    func setRigEnabled(_ enabled: Bool) {
        guard enabled != rigEnabled else { return }
        let resume = running || starting
        stop()
        rigEnabled = enabled
        UserDefaults.standard.set(enabled, forKey: "rigEnabled")
        midiStatus = enabled ? "Listening: Alive Rig Preview Control · channel 1" : "Rig off · send amp changes to Neural DSP through IAC."
        status = enabled ? "Built-in rig ready. Select your audio output." : "Notes only. Use Neural DSP for your amp sound."
        if resume { start() }
    }
    static func startupIssue(rigEnabled: Bool, inputAvailable: Bool, outputAvailable: Bool, modelAvailable: Bool) -> String? {
        guard inputAvailable else { return "Select an available guitar input and channel, then start again." }
        guard rigEnabled else { return nil }
        guard outputAvailable else { return "Select an available audio output, then start again." }
        guard modelAvailable else { return "The selected capture is missing. Choose your NAM model folder." }
        return nil
    }
    func rememberSettings() {
        let s = UserDefaults.standard
        s.set(devices.first(where: { $0.id == device })?.name, forKey: "input")
        s.set(outputs.first(where: { $0.id == output })?.name, forKey: "output")
        s.set(channel, forKey: "channel"); s.set(buffer, forKey: "buffer")
        s.set(gate, forKey: "noteGate"); s.set(threshold, forKey: "confidence")
        s.set(timing.lookaheadFrames, forKey: "lookahead"); s.set(timing.intervalFrames, forKey: "interval")
        s.set(compute.rawValue, forKey: "compute"); s.set(selected, forKey: "preset")
        s.set(modelsDirectory.path, forKey: "modelsDirectory")
    }
    func selectPreset(_ id: String) {
        guard let preset = presets.first(where: { $0.id == id }) else { return }
        selected = id; draft = preset
        if running { loadSound() }
        rememberSettings()
    }
    func save(asNew: Bool) {
        guard storeReadable else { presetStatus = "Repair presets.json before saving; the existing file has been preserved."; return }
        var preset = draft
        preset.name = preset.name.trimmingCharacters(in: .whitespacesAndNewlines)
        if asNew { preset.id = UUID().uuidString }
        var next = presets.filter { $0.id != preset.id }
        next.append(preset)
        do {
            try store.save(next.sorted { $0.program < $1.program })
            presets = next.sorted { $0.program < $1.program }; selected = preset.id; draft = preset
            presetStatus = "Saved \(preset.name) · Program \(preset.program)"
            rememberSettings()
        } catch { presetStatus = error.localizedDescription }
    }
    func updateControls() { if !loading { session?.controls(draft, muted: muted) } }
    func loadSound() {
        guard rigEnabled, let session else { return }
        soundGeneration += 1; pendingSound = draft; loading = true
        presetStatus = "Loading \(draft.name)…"
        session.load(draft, directory: modelsDirectory, generation: soundGeneration)
    }
    func start() {
        stop()
        let input = devices.first(where: { $0.id == device })
        let output = outputs.first(where: { $0.id == output })
        if let issue = Self.startupIssue(rigEnabled: rigEnabled,
            inputAvailable: input != nil && channel >= 0 && channel < (input?.channels ?? 0),
            outputAvailable: output != nil,
            modelAvailable: draft.valid && FileManager.default.fileExists(atPath: modelsDirectory.appendingPathComponent(draft.modelFile).path)) {
            status = issue; return
        }
        rememberSettings(); starting = true; status = "Requesting microphone access…"
        let request = generation
        AVCaptureDevice.requestAccess(for: .audio) { [weak self] allowed in
            DispatchQueue.main.async {
                guard let self, self.generation == request else { return }
                guard allowed else { self.starting = false; self.status = "Allow Alive Rig Preview in System Settings → Privacy & Security → Microphone."; return }
                do {
                    guard let url = Bundle.main.url(forResource: "nmp", withExtension: "mlmodelc") else { throw NSError(domain: "Rig", code: 1, userInfo: [NSLocalizedDescriptionKey: "The note model is missing. Rebuild the preview."]) }
                    if !self.rigEnabled {
                        try self.startNotesOnly(modelURL: url, request: request)
                        return
                    }
                    guard let input, let output else { return }
                    let session = RigSession(); self.session = session
                    rig_mute(session.pointer, self.muted ? 1 : 0)
                    session.report = { [weak self] notes, ms, db, drops, _, audioMS in
                        DispatchQueue.main.async {
                            guard let self, self.generation == request else { return }
                            self.pitches = notes; self.notes = notes.isEmpty ? "—" : notes.map(noteName).joined(separator: " · ")
                            self.inference = ms; self.inputDB = db; self.dropped = drops; self.audioMS = audioMS
                        }
                    }
                    session.detectionFailed = { [weak self] error in
                        DispatchQueue.main.async {
                            guard let self, self.generation == request else { return }
                            self.pitches = []; self.notes = "—"; self.status = error
                        }
                    }
                    session.loadFinished = { [weak self] id, error in
                        DispatchQueue.main.async {
                            guard let self, self.generation == request, self.soundGeneration == id else { return }
                            if let error { self.loading = false; self.pendingSound = nil; self.presetStatus = "\(error) Previous sound retained." }
                        }
                    }
                    try session.start(input: input.name, output: output.name, channel: self.channel, block: self.buffer,
                                      modelURL: url, gate: Float(self.gate), threshold: Float(self.threshold), timing: self.timing, compute: self.compute)
                    self.running = true; self.starting = false; self.lastAudio = Date(); self.lastCallbacks = 0
                    self.actualBuffer = Int(rig_buffer_size(session.pointer))
                    self.status = "Amp → \(output.name) · Notes → Alive Rig Preview Notes"
                    self.loadSound()
                    // Health checks follow audio callbacks, not inference reports. A stalled
                    // note model must never stop a healthy amp.
                    self.monitor = Timer.scheduledTimer(withTimeInterval: 0.2, repeats: true) { [weak self] _ in self?.checkAudio() }
                } catch { self.stop(); self.status = error.localizedDescription }
            }
        }
    }
    private func startNotesOnly(modelURL: URL, request: Int) throws {
        let capture = GuitarCapture(); noteCapture = capture
        capture.report = { [weak self] notes, ms, db, drops in
            DispatchQueue.main.async {
                guard let self, self.generation == request else { return }
                self.pitches = notes; self.notes = notes.isEmpty ? "—" : notes.map(noteName).joined(separator: " · ")
                self.inference = ms; self.inputDB = db; self.dropped = drops; self.lastAudio = Date()
            }
        }
        capture.failed = { [weak self] error in
            DispatchQueue.main.async {
                guard let self, self.generation == request else { return }
                self.stop(); self.status = error
            }
        }
        capture.configurationChanged = { [weak self, weak capture] in
            DispatchQueue.main.async {
                guard let self, self.generation == request, capture?.requiresReconnect == true else { return }
                self.stop(); self.status = "Guitar input changed. Check the interface and restart notes."
            }
        }
        try capture.start(device: device, channel: channel, modelURL: modelURL, gate: Float(gate),
                          threshold: Float(threshold), timing: timing, compute: compute, midiName: "Alive Rig Preview Notes")
        running = true; starting = false; lastAudio = Date()
        status = "Notes → Alive Rig Preview Notes · amp audio stays with Neural DSP"
        monitor = Timer.scheduledTimer(withTimeInterval: 0.2, repeats: true) { [weak self] _ in self?.checkAudio() }
    }
    func checkAudio() {
        if let noteCapture {
            if !noteCapture.engine.isRunning || Date().timeIntervalSince(lastAudio) > 2 {
                stop(); status = "Guitar input stopped. Check the interface and restart notes."
            }
            return
        }
        guard let session else { return }
        let callbacks = rig_callbacks(session.pointer)
        if callbacks != lastCallbacks { lastCallbacks = callbacks; lastAudio = Date() }
        if rig_fault(session.pointer) != 0 || Date().timeIntervalSince(lastAudio) > 2 {
            stop(); status = "Audio stopped or its format changed. Check the interface and restart at 48 kHz."; return
        }
        if loading, rig_active_generation(session.pointer) == soundGeneration, let pendingSound {
            loading = false; activeName = pendingSound.name; self.pendingSound = nil
            presetStatus = "Playing \(activeName)"; updateControls()
        }
    }
    func stop() {
        generation += 1; monitor?.invalidate(); monitor = nil
        session?.stop(); session = nil
        noteCapture?.stop(); noteCapture = nil
        running = false; starting = false; loading = false; pitches = []; notes = "—"; inputDB = -120
        pendingSound = nil; audioMS = 0; actualBuffer = 0; inference = 0; dropped = 0
        activeName = "No amp loaded"; status = "Stopped. Audio muted and notes released."
    }
    func refreshDevices() {
        devices = inputDevices(); outputs = inputDevices(scope: kAudioDevicePropertyScopeOutput)
        if !devices.contains(where: { $0.id == device }) { device = 0; channel = 0 }
        if !outputs.contains(where: { $0.id == output }) { output = 0 }
    }
    func chooseModels() {
        let panel = NSOpenPanel(); panel.canChooseDirectories = true; panel.canChooseFiles = false
        panel.message = "Choose the folder containing your 48 kHz amp-and-cab NAM captures."
        if panel.runModal() == .OK, let url = panel.url { modelsDirectory = url; rememberSettings() }
    }
}
