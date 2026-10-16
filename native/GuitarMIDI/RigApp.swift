import SwiftUI
import AVFoundation

struct RigView: View {
    @StateObject var state = RigState()
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
            HStack(spacing: 16) {
                VStack(alignment: .leading, spacing: 5) {
                    RigCaption(text: "GUITAR INPUT")
                    Picker("Guitar input", selection: $state.device) {
                        Text("Select guitar input").tag(AudioDeviceID(0))
                        ForEach(state.devices) { Text($0.name).tag($0.id) }
                    }.labelsHidden().onChange(of: state.device) { _, _ in state.channel = 0 }
                }.frame(maxWidth: .infinity, alignment: .leading)
                VStack(alignment: .leading, spacing: 5) {
                    RigCaption(text: "CHANNEL")
                    Picker("Input channel", selection: $state.channel) {
                        ForEach(0..<state.channelCount, id: \.self) { Text("Channel \($0 + 1)").tag($0) }
                    }.labelsHidden().frame(width: 120)
                }
            }
            HStack(spacing: 20) {
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

    private var meters: some View {
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
                RigCaption(text: "DROPS")
                Text("\(state.dropped)").font(RigStyle.pixel(24)).foregroundStyle(state.dropped > 0 ? RigStyle.gold : RigStyle.bone)
            }
        }.padding(10).background(RigStyle.tolex)
    }

    private func notesPanel(stageHeight: CGFloat) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("GUITAR → MIDI").font(RigStyle.pixel(30)).foregroundStyle(RigStyle.gold)
            ScrollView {
                VStack(alignment: .leading, spacing: 12) {
                    VoxelStage(pitches: state.pitches).aspectRatio(360.0 / 204.0, contentMode: .fit)
                        .frame(height: stageHeight).frame(maxWidth: .infinity)
                        .overlay(Rectangle().stroke(RigStyle.raised, lineWidth: 2))
                    HStack {
                        RigCaption(text: "NOTES")
                        if state.pitches.isEmpty {
                            Text("Play a chord. Make some noise.").font(RigStyle.pixel(25))
                        } else {
                            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 4), count: 6), spacing: 4) {
                                ForEach(state.pitches, id: \.self) { pitch in
                                    Text(noteName(pitch)).font(RigStyle.pixel(27)).foregroundStyle(RigStyle.frets[RigStyle.lane(pitch)])
                                }
                            }
                        }
                        Spacer(minLength: 0)
                    }.frame(minHeight: 30).accessibilityElement(children: .ignore).accessibilityLabel("Detected notes: \(state.notes)")
                    inputControls
                    meters
                    Text("Website guitar input: Alive Rig Preview Notes")
                        .font(RigStyle.body(14)).foregroundStyle(RigStyle.dust)
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
                Button(state.rigEnabled ? "Turn rig off" : "Turn rig on") { state.setRigEnabled(!state.rigEnabled) }
                    .buttonStyle(StompButton())
            }.frame(height: 30)
            ScrollView {
                VStack(alignment: .leading, spacing: 12) {
                    if state.rigEnabled {
                        RigRouteControls(state: state).disabled(busy)
                        RigAmpControls(state: state)
                        Text("48 kHz · \(state.actualBuffer > 0 ? state.actualBuffer : state.buffer) samples · amp processing \(state.audioMS, specifier: "%.2f") ms")
                            .font(RigStyle.body(14)).foregroundStyle(RigStyle.dust)
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
                    Text("ALIVE & KICKING").font(RigStyle.pixel(43))
                    Text("RIG PREVIEW / AMP + CHORDS & RIFFS").font(RigStyle.caps(10)).foregroundStyle(RigStyle.gold)
                }
                Spacer()
                HStack(spacing: 8) {
                    Rectangle().fill(state.running ? RigStyle.frets[0] : RigStyle.gold).frame(width: 8, height: 8)
                    Text(state.running ? "ON AIR" : state.starting ? "CONNECTING" : "STANDBY").font(RigStyle.caps(10))
                }.padding(12).background(RigStyle.tolex)
            }.padding(.horizontal, 24).padding(.vertical, 14)
            GeometryReader { geometry in
                HStack(alignment: .top, spacing: 20) {
                    notesPanel(stageHeight: min(140, max(105, geometry.size.height * 0.24)))
                    Rectangle().fill(RigStyle.raised).frame(width: 2)
                    rigPanel
                }
            }.padding(.horizontal, 24).padding(.bottom, 12)
            VStack(alignment: .leading, spacing: 10) {
                Text(state.status).font(RigStyle.body(16)).fixedSize(horizontal: false, vertical: true)
                HStack(spacing: 16) {
                    Button(busy ? "Stop / release notes" : state.rigEnabled ? "Start rig" : "Start notes") {
                        if busy { state.stop() } else { state.start() }
                    }.buttonStyle(StompButton(primary: true)).keyboardShortcut(.return, modifiers: [.command])
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
