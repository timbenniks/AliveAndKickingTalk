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
    @Published var timing = DetectorTiming()
    @Published var compute = DetectorCompute.automatic
    @Published var running = false
    @Published var starting = false
    @Published var status = "Choose your clean guitar input."
    @Published var notes = "—"
    @Published var pitches: [Int] = []
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
                        self.pitches = notes
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
                    self.inference = 0; self.dropped = 0
                    try capture.start(device: self.device, channel: self.channel, modelURL: url, gate: Float(self.gate), threshold: Float(self.threshold), timing: self.timing, compute: self.compute)
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
        running = false; starting = false; notes = "—"; pitches = []; inputDB = -120
        status = "Stopped. All notes released."
    }
}

struct GuitarView: View {
    @StateObject var state = GuitarState()
    private var busy: Bool { state.running || state.starting }

    private var timingControls: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 12) {
                RigCaption(text: "RESPONSE")
                Picker("Response preset", selection: Binding(get: { state.timing.presetName }, set: {
                    if let preset = TimingPreset(rawValue: $0) { state.timing = preset.timing }
                })) {
                    ForEach(TimingPreset.allCases, id: \.self) { Text($0.rawValue).tag($0.rawValue) }
                    if state.timing.presetName == "Custom" { Text("Custom").tag("Custom") }
                }.labelsHidden().frame(width: 140)
                Spacer()
                Text("Acceleration")
                Picker("Core ML acceleration", selection: $state.compute) {
                    ForEach(DetectorCompute.allCases, id: \.self) { Text($0.rawValue).tag($0) }
                }.labelsHidden().frame(width: 140)
            }
            HStack(spacing: 24) {
                VStack(alignment: .leading, spacing: 2) {
                    HStack { Text("Lookahead"); Spacer(); Text("\(state.timing.lookaheadMS, specifier: "%.1f") ms").foregroundStyle(RigStyle.gold) }
                    Slider(value: Binding(get: { Double(state.timing.lookaheadFrames) }, set: {
                        state.timing = DetectorTiming(lookaheadFrames: Int($0), intervalFrames: state.timing.intervalFrames)
                    }), in: 2...20, step: 1).accessibilityLabel("Lookahead frames")
                }
                VStack(alignment: .leading, spacing: 2) {
                    HStack { Text("Analysis interval"); Spacer(); Text("\(state.timing.intervalMS, specifier: "%.1f") ms").foregroundStyle(RigStyle.gold) }
                    Slider(value: Binding(get: { Double(state.timing.intervalFrames) }, set: {
                        state.timing = DetectorTiming(lookaheadFrames: state.timing.lookaheadFrames, intervalFrames: Int($0))
                    }), in: 1...8, step: 1).accessibilityLabel("Analysis interval frames")
                }
            }
            Text("Less lookahead reacts sooner; more may help note accuracy. Shorter intervals use more processing.")
                .font(RigStyle.body(14)).foregroundStyle(RigStyle.dust).fixedSize(horizontal: false, vertical: true)
        }.disabled(busy).tint(RigStyle.gold).pickerStyle(.menu)
            .padding(16).background(RigStyle.tolex)
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                HStack(alignment: .center) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("ALIVE & KICKING").font(RigStyle.pixel(43)).foregroundStyle(RigStyle.bone)
                        Text("GUITAR MIDI / CHORDS & RIFFS").font(RigStyle.caps(10)).foregroundStyle(RigStyle.gold)
                    }
                    Spacer()
                    HStack(spacing: 8) {
                        Rectangle().fill(state.running ? RigStyle.frets[0] : RigStyle.gold).frame(width: 8,height: 8)
                        Text(state.running ? "ON AIR" : state.starting ? "CONNECTING" : "STANDBY").font(RigStyle.caps(10))
                    }.padding(12).background(RigStyle.tolex)
                }
                HStack(alignment: .top, spacing: 20) {
                    VStack(alignment: .leading, spacing: 14) {
                        RigCaption(text: "YOUR RIG")
                        VStack(alignment: .leading, spacing: 6) {
                            Text("Guitar input")
                            Picker("Guitar input", selection: $state.device) {
                                Text("System default input").tag(AudioDeviceID(0))
                                ForEach(state.devices) { Text($0.name).tag($0.id) }
                            }.labelsHidden().onChange(of: state.device) { _, _ in state.channel = 0 }
                        }
                        VStack(alignment: .leading, spacing: 6) {
                            Text("Input channel")
                            Picker("Input channel", selection: $state.channel) {
                                ForEach(0..<state.channelCount, id: \.self) { Text("Channel \($0 + 1)").tag($0) }
                            }.labelsHidden()
                        }
                        VStack(alignment: .leading, spacing: 2) {
                            HStack { Text("Noise gate"); Spacer(); Text("\(Int(state.gate)) dB").foregroundStyle(RigStyle.gold) }
                            Slider(value: $state.gate, in: -85 ... -30, step: 1).accessibilityLabel("Noise gate")
                            HStack { Text("Confidence"); Spacer(); Text(state.threshold, format: .number.precision(.fractionLength(2))).foregroundStyle(RigStyle.gold) }
                            Slider(value: $state.threshold, in: 0.25 ... 0.8, step: 0.05).accessibilityLabel("Note confidence")
                        }
                        Text("Clean DI, before your amp effects. Stop listening to change the settings.")
                            .font(RigStyle.body(14)).foregroundStyle(RigStyle.dust).fixedSize(horizontal: false, vertical: true)
                    }
                    .disabled(busy).tint(RigStyle.gold).pickerStyle(.menu)
                    .padding(18).frame(width: 276, alignment: .leading)
                    .background(RigStyle.tolex).overlay(Rectangle().stroke(RigStyle.raised,lineWidth: 2))

                    VStack(alignment: .leading, spacing: 12) {
                        VoxelStage(pitches: state.pitches).frame(height: 202)
                            .overlay(Rectangle().stroke(RigStyle.raised,lineWidth: 2))
                        HStack { RigCaption(text: "DETECTED NOTES"); Spacer(); Text("\(state.pitches.count) voices").font(RigStyle.body(14)).foregroundStyle(RigStyle.dust) }
                        if state.pitches.isEmpty {
                            Text("Play a chord. Make some noise.").font(RigStyle.pixel(25)).foregroundStyle(RigStyle.bone)
                            Text("Your notes will light up the fretboard.").font(RigStyle.body(14)).foregroundStyle(RigStyle.dust)
                        } else {
                            LazyVGrid(columns: Array(repeating: GridItem(.flexible(),spacing: 6), count: 6), spacing: 6) {
                                ForEach(state.pitches, id: \.self) { pitch in
                                    Text(noteName(pitch)).font(RigStyle.pixel(27)).foregroundStyle(RigStyle.frets[RigStyle.lane(pitch)])
                                        .frame(maxWidth: .infinity).padding(.vertical, 7).background(RigStyle.tolex)
                                        .overlay(alignment: .bottom) { Rectangle().fill(RigStyle.frets[RigStyle.lane(pitch)]).frame(height: 3) }
                                }
                            }.accessibilityElement(children: .ignore).accessibilityLabel("Detected notes: \(state.notes)")
                        }
                    }.frame(maxWidth: .infinity, alignment: .leading)
                }
                timingControls
                HStack(spacing: 16) {
                    Button(busy ? "Stop / release notes" : "Start listening") {
                        if busy { state.stop() } else { state.start() }
                    }.buttonStyle(StompButton(primary: true)).keyboardShortcut(.space, modifiers: [])
                    Button("Refresh inputs") {
                        state.devices = inputDevices()
                        if !state.devices.contains(where: { $0.id == state.device }) { state.device = 0 }
                    }.buttonStyle(StompButton()).disabled(busy)
                }
                VStack(alignment: .leading, spacing: 10) {
                    Text(state.status).font(RigStyle.body(17)).fixedSize(horizontal: false, vertical: true)
                    HStack(spacing: 18) {
                        VStack(alignment: .leading, spacing: 6) {
                            RigCaption(text: "INPUT / \(Int(state.inputDB)) DB")
                            HStack(spacing: 3) {
                                ForEach(0..<20) { i in
                                    Rectangle().fill(Double(state.inputDB) > -70 + Double(i)*3.5 ? (i > 17 ? RigStyle.frets[1] : RigStyle.gold) : RigStyle.raised).frame(height: 8)
                                }
                            }.accessibilityLabel("Input level \(Int(state.inputDB)) decibels")
                        }.frame(maxWidth: .infinity)
                        VStack(alignment: .leading, spacing: 3) {
                            RigCaption(text: "INFERENCE")
                            Text("\(state.inference, specifier: "%.1f") ms").font(RigStyle.pixel(24))
                        }
                        VStack(alignment: .leading, spacing: 3) {
                            RigCaption(text: "DROPPED BUFFERS")
                            Text("\(state.dropped)").font(RigStyle.pixel(24)).foregroundStyle(state.dropped > 0 ? RigStyle.gold : RigStyle.bone)
                        }
                    }
                }.padding(16).background(RigStyle.tolex)
                VStack(alignment: .leading, spacing: 6) {
                    Text("NEXT STOP: THE STAGE").font(RigStyle.caps(10)).foregroundStyle(RigStyle.gold)
                    Text("Website Rig → Neck follows → Guitar MIDI → Alive Guitar MIDI.").font(RigStyle.body(16))
                    Text("Lookahead and inference time are only parts of the total delay. Audio stays on this Mac; monitoring stays with your amp.")
                        .font(RigStyle.body(14)).foregroundStyle(RigStyle.dust).fixedSize(horizontal: false, vertical: true)
                    Text("Lower confidence for missed notes; raise it for extra notes. Fixed MIDI velocity; no pitch bends or string identification.")
                        .font(RigStyle.body(14)).foregroundStyle(RigStyle.dust).fixedSize(horizontal: false, vertical: true)
                }
            }
            .font(RigStyle.body()).foregroundStyle(RigStyle.bone)
            .padding(24).frame(width: 760)
        }.frame(width: 760, height: min(890, (NSScreen.main?.visibleFrame.height ?? 980) - 80)).background(RigStyle.night)
        .preferredColorScheme(.dark)
        .onDisappear { state.stop() }
    }
}

@main
struct GuitarMIDIApp: App {
    init() {
        RigStyle.registerFonts()
        if CommandLine.arguments.contains("--self-test") {
            do { try runSelfTest(); exit(0) }
            catch { fputs("Self-test failed: \(error)\n", stderr); exit(1) }
        }
        if let index = CommandLine.arguments.firstIndex(of: "--input-test") {
            do { try runInputTest(arguments: Array(CommandLine.arguments.dropFirst(index + 1))); exit(0) }
            catch { fputs("Input test failed: \(error)\n", stderr); exit(1) }
        }
    }
    var body: some Scene {
        Window("Alive Guitar MIDI", id: "main") { GuitarView() }
            .windowResizability(.contentSize)
    }
}
