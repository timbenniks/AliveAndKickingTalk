import SwiftUI
import AVFoundation

struct RigView: View {
    @StateObject var state = RigState()
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
                        Text("RIG PREVIEW / AMP + CHORDS & RIFFS").font(RigStyle.caps(10)).foregroundStyle(RigStyle.gold)
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
                                Text("Select guitar input").tag(AudioDeviceID(0))
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
                            HStack { Text("Note gate"); Spacer(); Text("\(Int(state.gate)) dB").foregroundStyle(RigStyle.gold) }
                            Slider(value: $state.gate, in: -85 ... -30, step: 1).accessibilityLabel("Note gate")
                            HStack { Text("Confidence"); Spacer(); Text(state.threshold, format: .number.precision(.fractionLength(2))).foregroundStyle(RigStyle.gold) }
                            Slider(value: $state.threshold, in: 0.25 ... 0.8, step: 0.05).accessibilityLabel("Note confidence")
                        }
                        Text("One clean input for your amp and note detection. Stop the rig to change this setup.")
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
                RigRouteControls(state: state).disabled(busy)
                RigAmpControls(state: state)
                DisclosureGroup("NOTE RESPONSE") { timingControls }.tint(RigStyle.gold)
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
                Text("48 kHz · \(state.actualBuffer > 0 ? state.actualBuffer : state.buffer) samples · amp processing \(state.audioMS, specifier: "%.2f") ms (not total latency)").font(RigStyle.body(14)).foregroundStyle(RigStyle.dust)
                VStack(alignment: .leading, spacing: 6) {
                    Text("NEXT STOP: THE STAGE").font(RigStyle.caps(10)).foregroundStyle(RigStyle.gold)
                    Text("Website: Guitar MIDI → Alive Rig Preview Notes. Amp output → Alive Rig Preview Control.").font(RigStyle.body(16))
                    Text("Listen through your selected interface output. Turn off its direct monitoring to hear only the amp. Note lookahead never delays the amp sound.")
                        .font(RigStyle.body(14)).foregroundStyle(RigStyle.dust).fixedSize(horizontal: false, vertical: true)
                    Text("Lower confidence for missed notes; raise it for extra notes. Fixed MIDI velocity; no pitch bends or string identification.")
                        .font(RigStyle.body(14)).foregroundStyle(RigStyle.dust).fixedSize(horizontal: false, vertical: true)
                }
            }
            .font(RigStyle.body()).foregroundStyle(RigStyle.bone)
            .padding(24).frame(width: 760)
        }.safeAreaInset(edge: .bottom, spacing: 0) {
                HStack(spacing: 16) {
                    Button(busy ? "Stop rig / release notes" : "Start rig") {
                        if busy { state.stop() } else { state.start() }
                    }.buttonStyle(StompButton(primary: true)).keyboardShortcut(.return, modifiers: [.command])
                    Button("Refresh devices") {
                        state.refreshDevices()
                    }.buttonStyle(StompButton()).disabled(busy)
                }
                    .padding(16).background(RigStyle.night)
                    .overlay(alignment: .top) { Rectangle().fill(RigStyle.raised).frame(height: 2) }
        }.frame(width: 760, height: min(890, (NSScreen.main?.visibleFrame.height ?? 980) - 80)).background(RigStyle.night)
        .preferredColorScheme(.dark)
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
        Window("Alive Rig Preview", id: "rig-preview") {
            RigView().onAppear {
                if let url = Bundle.main.url(forResource: "AppIcon", withExtension: "icns"), let icon = NSImage(contentsOf: url) {
                    NSApplication.shared.applicationIconImage = icon
                }
            }
        }.windowResizability(.contentSize)
    }
}
