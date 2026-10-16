import SwiftUI
import AVFoundation

struct RigView: View {
    @StateObject var state: RigState
    init(state: RigState = RigState()) { _state = StateObject(wrappedValue: state) }
    private var busy: Bool { state.running || state.starting }

    private var responseControls: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text("Response")
                Picker("Response preset", selection: Binding(get: { state.timing.presetName }, set: {
                    if let preset = TimingPreset(rawValue: $0) { state.timing = preset.timing }
                })) {
                    ForEach(TimingPreset.allCases, id: \.self) { Text($0.rawValue).tag($0.rawValue) }
                    if state.timing.presetName == "Custom" { Text("Custom").tag("Custom") }
                }.labelsHidden()
            }
            DisclosureGroup("ADVANCED NOTE SETTINGS") {
                VStack(alignment: .leading, spacing: 8) {
                    HStack {
                        Text("Acceleration")
                        Picker("Core ML acceleration", selection: $state.compute) {
                            ForEach(DetectorCompute.allCases, id: \.self) { Text($0.rawValue).tag($0) }
                        }.labelsHidden()
                    }
                    HStack { Text("Lookahead"); Spacer(); Text("\(state.timing.lookaheadMS, specifier: "%.1f") ms").foregroundStyle(RigStyle.gold) }
                    Slider(value: Binding(get: { Double(state.timing.lookaheadFrames) }, set: {
                        state.timing = DetectorTiming(lookaheadFrames: Int($0), intervalFrames: state.timing.intervalFrames)
                    }), in: 2...20, step: 1).accessibilityLabel("Lookahead frames")
                    HStack { Text("Analysis interval"); Spacer(); Text("\(state.timing.intervalMS, specifier: "%.1f") ms").foregroundStyle(RigStyle.gold) }
                    Slider(value: Binding(get: { Double(state.timing.intervalFrames) }, set: {
                        state.timing = DetectorTiming(lookaheadFrames: state.timing.lookaheadFrames, intervalFrames: Int($0))
                    }), in: 1...8, step: 1).accessibilityLabel("Analysis interval frames")
                    Text("Less lookahead reacts sooner; more may help accuracy. Shorter intervals use more processing.")
                        .font(RigStyle.body(14)).foregroundStyle(RigStyle.dust)
                }.padding(.top, 8)
            }.font(RigStyle.body(14))
        }.disabled(busy)
    }

    private var inputControls: some View {
        VStack(alignment: .leading, spacing: 10) {
            VStack(spacing: 8) {
                VStack(spacing: 2) {
                    HStack { Text("Note gate"); Spacer(); Text("\(Int(state.gate)) dB").foregroundStyle(RigStyle.gold) }
                    Slider(value: $state.gate, in: -85 ... -30, step: 1).accessibilityLabel("Note gate")
                }
                VStack(spacing: 2) {
                    HStack { Text("Confidence"); Spacer(); Text(state.threshold, format: .number.precision(.fractionLength(2))).foregroundStyle(RigStyle.gold) }
                    Slider(value: $state.threshold, in: 0.25 ... 0.8, step: 0.05).accessibilityLabel("Note confidence")
                }
            }
            responseControls
        }.disabled(busy).padding(12).background(RigStyle.tolex)
    }

    private var notesPanel: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("GUITAR → MIDI").font(RigStyle.pixel(30)).foregroundStyle(RigStyle.gold).frame(height: 30)
            ScrollView {
                VStack(alignment: .leading, spacing: 12) {
                    RigNoteMonitor(live: state.live)
                    inputControls
                    Text("MIDI OUT · Alive Rig Preview Notes")
                        .font(RigStyle.body(13)).foregroundStyle(RigStyle.dust).lineLimit(1)
                }.padding(.trailing, 4).padding(.bottom, 4)
            }
        }.frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }

    private var rigPanel: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("AMP RIG").font(RigStyle.pixel(30)).foregroundStyle(RigStyle.gold)
                Rectangle().fill(state.rigEnabled ? RigStyle.frets[0] : RigStyle.dust).frame(width: 8, height: 8)
                Text(state.rigEnabled ? "ON" : "OFF").font(RigStyle.caps())
                Spacer()
                if state.rigEnabled {
                    Button(state.muted ? "Unmute" : "Mute amp") { state.muted.toggle() }
                        .buttonStyle(StompButton()).accessibilityLabel(state.muted ? "Unmute amp output" : "Mute amp output; keep detecting notes")
                }
            }.frame(height: 30)
            if state.rigEnabled { RigAmpControls(state: state).soundSelector }
            ScrollView {
                VStack(alignment: .leading, spacing: 12) {
                    if state.rigEnabled {
                        RigAmpControls(state: state)
                    } else {
                        VStack(alignment: .leading, spacing: 20) {
                            Text("BRING YOUR OWN AMP").font(RigStyle.pixel(36)).foregroundStyle(RigStyle.gold)
                            Text("Guitar notes keep flowing. Neural DSP handles your sound.").font(RigStyle.body(22))
                            Rectangle().fill(RigStyle.raised).frame(height: 2)
                            VStack(alignment: .leading, spacing: 8) {
                                RigCaption(text: "NEURAL DSP")
                                Text("Select your guitar input and audio interface output in Neural DSP.")
                            }
                            VStack(alignment: .leading, spacing: 8) {
                                RigCaption(text: "WEBSITE AMP OUTPUT")
                                Text("IAC Driver Alive and Kicking").foregroundStyle(RigStyle.gold)
                                Text("Keep Neural DSP listening to this IAC port for preset changes.")
                            }
                            Text("This app captures notes only: no amp processing or audio output. Your saved rig sounds are kept for next time.")
                                .font(RigStyle.body(16)).foregroundStyle(RigStyle.dust)
                        }.padding(24).frame(maxWidth: .infinity, alignment: .leading)
                            .background(RigStyle.tolex).overlay(Rectangle().stroke(RigStyle.raised, lineWidth: 2))
                    }
                }.padding(.trailing, 4).padding(.bottom, 4)
            }
        }.frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text("ALIVE & KICKING").font(RigStyle.pixel(34))
                    Text("RIG PREVIEW / AMP + CHORDS & RIFFS").font(RigStyle.caps(10)).foregroundStyle(RigStyle.gold)
                }
                Spacer()
                HStack(spacing: 8) {
                    Rectangle().fill(state.running ? RigStyle.frets[0] : RigStyle.gold).frame(width: 8, height: 8)
                    Text(state.running ? "ON AIR" : state.starting ? "CONNECTING" : "STANDBY").font(RigStyle.caps(10))
                }.padding(12).background(RigStyle.tolex)
            }.padding(.horizontal, 24).padding(.vertical, 10)
            RigAudioSetup(state: state).padding(.horizontal, 24).padding(.bottom, 12)
            GeometryReader { geometry in
                let available = max(0, geometry.size.width - 42)
                let notesWidth = min(360, max(300, available * 0.28))
                HStack(alignment: .top, spacing: 20) {
                    notesPanel.frame(width: notesWidth)
                    Rectangle().fill(RigStyle.raised).frame(width: 2)
                    rigPanel.frame(width: max(0, available - notesWidth))
                }
            }.padding(.horizontal, 24).padding(.bottom, 12)
            HStack(spacing: 16) {
                Text(state.status).font(RigStyle.body(16)).lineLimit(2)
                    .frame(maxWidth: .infinity, alignment: .leading).frame(height: 36).help(state.status)
                HStack(spacing: 16) {
                    Button(busy ? "Stop / release notes" : state.rigEnabled ? "Start rig" : "Start notes") {
                        if busy { state.stop() } else { state.start() }
                    }.buttonStyle(StompButton(primary: true)).frame(width: 240).keyboardShortcut(.return, modifiers: [.command])
                    Button(state.rigEnabled ? "Turn rig off" : "Turn rig on") { state.setRigEnabled(!state.rigEnabled) }
                        .buttonStyle(StompButton())
                    Button("Refresh devices") { state.refreshDevices() }.buttonStyle(StompButton()).disabled(busy)
                }
            }.padding(16).background(RigStyle.night)
                .overlay(alignment: .top) { Rectangle().fill(RigStyle.raised).frame(height: 2) }
        }.font(RigStyle.body()).foregroundStyle(RigStyle.bone).tint(RigStyle.gold).pickerStyle(.menu)
            .frame(minWidth: 1040, minHeight: 600).background(RigStyle.night).preferredColorScheme(.dark)
            .onDisappear { state.stop() }
    }
}

@main
struct AliveRigPreviewApp: App {
    init() {
        RigStyle.registerFonts()
        if CommandLine.arguments.contains("--display-test") {
            do { try runRigDisplayTest(); exit(0) }
            catch { fputs("Display test failed: \(error)\n", stderr); exit(1) }
        }
        if let index = CommandLine.arguments.firstIndex(of: "--offline-test"), CommandLine.arguments.count > index + 1 {
            do { try runCombinedRigTest(modelPath: CommandLine.arguments[index + 1]); exit(0) }
            catch { fputs("Combined test failed: \(error)\n", stderr); exit(1) }
        }
        if CommandLine.arguments.contains("--self-test") {
            do { try runSelfTest(); try runRigSelfTest(); exit(0) }
            catch { fputs("Self-test failed: \(error)\n", stderr); exit(1) }
        }
    }
    var body: some Scene {
        Window("Alive Rig Preview", id: "rig-preview-wide") {
            RigView().onAppear {
                if let url = Bundle.main.url(forResource: "AppIcon", withExtension: "icns"), let icon = NSImage(contentsOf: url) {
                    NSApplication.shared.applicationIconImage = icon
                }
            }
        }.defaultSize(width: 1280, height: 720).windowResizability(.contentMinSize)
    }
}
