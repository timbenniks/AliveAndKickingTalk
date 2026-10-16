import SwiftUI
import CoreAudio

struct RigAudioSetup: View {
    @ObservedObject var state: RigState
    private var inputName: String { state.devices.first(where: { $0.id == state.device })?.name ?? "Select input" }
    private var outputName: String { state.outputs.first(where: { $0.id == state.output })?.name ?? "Select output" }
    var body: some View {
        DisclosureGroup {
            HStack(alignment: .top, spacing: 20) {
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
                    }.labelsHidden()
                }.frame(width: 120)
                VStack(alignment: .leading, spacing: 5) {
                    RigCaption(text: "RIG OUTPUT")
                    Picker("Audio output", selection: $state.output) {
                        Text("Select audio output").tag(AudioDeviceID(0))
                        ForEach(state.outputs) { Text($0.name).tag($0.id) }
                    }.labelsHidden().disabled(!state.rigEnabled)
                }.frame(maxWidth: .infinity, alignment: .leading)
                VStack(alignment: .leading, spacing: 5) {
                    RigCaption(text: "RIG BUFFER / 48 KHZ")
                    Picker("Audio buffer", selection: $state.buffer) {
                        ForEach([64, 128, 256], id: \.self) { Text("\($0) samples").tag($0) }
                    }.labelsHidden().disabled(!state.rigEnabled)
                }.frame(width: 170)
            }.disabled(state.running || state.starting).padding(.top, 10)
            Text(state.running || state.starting ? "Stop to change the audio setup." : state.rigEnabled ? "Built-in rig uses outputs 1–2 at 48 kHz." : "Notes only: choose output and buffer in Neural DSP.")
                .font(RigStyle.body(14)).foregroundStyle(RigStyle.dust).padding(.top, 4)
        } label: {
            HStack(spacing: 20) {
                Text("AUDIO SETUP").font(RigStyle.caps(10)).foregroundStyle(RigStyle.gold)
                Text("\(inputName) · Ch \(state.channel + 1) → \(state.rigEnabled ? outputName : "External amp")")
                    .font(RigStyle.body(15)).lineLimit(1).truncationMode(.middle)
                Spacer(minLength: 0)
                Text(state.rigEnabled ? "\(state.actualBuffer > 0 ? state.actualBuffer : state.buffer) samples · 48 kHz" : "NOTES ONLY")
                    .font(RigStyle.body(14)).foregroundStyle(RigStyle.dust)
            }
        }.tint(RigStyle.gold).pickerStyle(.menu).padding(12).background(RigStyle.tolex)
    }
}

// A drawn dial with native keyboard focus and VoiceOver adjustment. Drag vertically
// for a full sweep over 240 points; arrow keys use the control's step size.
struct RigDial: View {
    let title: String
    let label: String
    @Binding var value: Double
    let range: ClosedRange<Double>
    var suffix = " dB"
    var emphasized = false
    var tint: Color? = nil
    var diameter: CGFloat = 68
    var step: Double = 0.5
    var wholeNumbers = false
    @State private var dragStart: Double?
    @FocusState private var focused: Bool
    @Environment(\.isEnabled) private var enabled
    private var fraction: Double { (value - range.lowerBound) / (range.upperBound - range.lowerBound) }
    private var accent: Color { tint ?? (emphasized ? RigStyle.gold : RigStyle.bone) }
    private var readout: String { (wholeNumbers ? String(Int(value.rounded())) : String(format: "%.1f", value)) + suffix }
    private func set(_ next: Double) { value = min(range.upperBound, max(range.lowerBound, (next / step).rounded() * step)) }
    var body: some View {
        VStack(spacing: 3) {
            Text(title).font(RigStyle.caps(diameter < 68 ? 8 : 10)).foregroundStyle(accent).lineLimit(1)
            Canvas { context, _ in
                context.scaleBy(x: diameter / 80, y: diameter / 80)
                for tick in 0...12 {
                    let angle = (-225 + Double(tick) * 22.5) * .pi / 180
                    let x = (40 + cos(angle) * 35).rounded(), y = (40 + sin(angle) * 35).rounded()
                    context.fill(Path(CGRect(x: x - 1, y: y - 1, width: 3, height: 3)), with: .color(Double(tick) / 12 <= fraction ? accent : RigStyle.dust.opacity(0.4)))
                }
                let points = [CGPoint(x: 25, y: 12), CGPoint(x: 55, y: 12), CGPoint(x: 68, y: 25), CGPoint(x: 68, y: 55), CGPoint(x: 55, y: 68), CGPoint(x: 25, y: 68), CGPoint(x: 12, y: 55), CGPoint(x: 12, y: 25)]
                var outline = Path(); outline.addLines(points); outline.closeSubpath()
                context.fill(outline, with: .color(RigStyle.night))
                context.stroke(outline, with: .color(focused ? RigStyle.gold : RigStyle.dust), lineWidth: focused ? 3 : 2)
                let angle = (-225 + fraction * 270) * .pi / 180
                var pointer = Path()
                pointer.move(to: CGPoint(x: 40 + cos(angle) * 12, y: 40 + sin(angle) * 12))
                pointer.addLine(to: CGPoint(x: 40 + cos(angle) * 24, y: 40 + sin(angle) * 24))
                context.stroke(pointer, with: .color(accent), style: StrokeStyle(lineWidth: 4, lineCap: .square))
            }.frame(width: diameter, height: diameter).contentShape(Rectangle())
            Text(readout).font(RigStyle.body(diameter < 68 ? 14 : 17)).monospacedDigit().foregroundStyle(accent).lineLimit(1)
        }.frame(maxWidth: .infinity).opacity(enabled ? 1 : 0.45)
            .contentShape(Rectangle()).focusable().focused($focused).focusEffectDisabled()
            .gesture(DragGesture(minimumDistance: 1).onChanged { event in
                guard enabled else { return }
                focused = true
                if dragStart == nil { dragStart = value }
                set((dragStart ?? value) - Double(event.translation.height) * (range.upperBound - range.lowerBound) / 240)
            }.onEnded { _ in dragStart = nil })
            .onKeyPress(.upArrow) { guard enabled else { return .ignored }; set(value + step); return .handled }
            .onKeyPress(.rightArrow) { guard enabled else { return .ignored }; set(value + step); return .handled }
            .onKeyPress(.downArrow) { guard enabled else { return .ignored }; set(value - step); return .handled }
            .onKeyPress(.leftArrow) { guard enabled else { return .ignored }; set(value - step); return .handled }
            .accessibilityElement(children: .ignore).accessibilityLabel(label)
            .accessibilityValue(readout)
            .accessibilityAdjustableAction { direction in
                guard enabled else { return }
                if direction == .increment { set(value + step) }
                if direction == .decrement { set(value - step) }
            }
            .help("\(label): drag up or down, or use arrow keys for \(step.formatted()) steps.")
    }
}

private struct AmpGrille: View {
    var body: some View {
        Canvas { context, size in
            for y in stride(from: CGFloat(0), to: size.height, by: 6) {
                for x in stride(from: CGFloat(0), to: size.width, by: 6) {
                    context.fill(Path(CGRect(x: x, y: y, width: 2, height: 4)), with: .color(RigStyle.dust.opacity(0.32)))
                    context.fill(Path(CGRect(x: x + 2, y: y + 2, width: 4, height: 2)), with: .color(RigStyle.raised))
                }
            }
        }.background(RigStyle.night).accessibilityHidden(true)
    }
}

struct RigAmpControls: View {
    @ObservedObject var state: RigState
    private var selectedIndex: Int { state.presets.firstIndex(where: { $0.id == state.selected }) ?? 0 }
    private func stepPreset(_ delta: Int) {
        let index = selectedIndex + delta
        if state.presets.indices.contains(index) { state.selectPreset(state.presets[index].id) }
    }
    var soundSelector: some View {
        VStack(alignment: .leading, spacing: 2) {
            HStack {
                RigCaption(text: "SAVED SOUND")
                Spacer()
                Text("PC \(state.draft.program)").font(RigStyle.caps(10)).foregroundStyle(RigStyle.gold)
                if state.dirty { Text("EDITED").font(RigStyle.caps(9)).foregroundStyle(RigStyle.gold) }
            }
            HStack(spacing: 12) {
                Button { stepPreset(-1) } label: { Text("‹").font(RigStyle.pixel(32)) }
                    .buttonStyle(.plain).disabled(selectedIndex == 0).accessibilityLabel("Previous saved sound")
                Text(state.draft.name).font(RigStyle.pixel(32)).foregroundStyle(RigStyle.bone)
                    .lineLimit(1).minimumScaleFactor(0.6).frame(maxWidth: .infinity, alignment: .leading)
                Menu {
                    ForEach(state.presets) { preset in
                        Button("\(preset.program) · \(preset.name)") { state.selectPreset(preset.id) }
                    }
                } label: { Image(systemName: "chevron.down") }
                    .menuStyle(.borderlessButton).menuIndicator(.hidden).frame(width: 24)
                    .accessibilityLabel("Saved sound").accessibilityValue(state.draft.name)
                Button { stepPreset(1) } label: { Text("›").font(RigStyle.pixel(32)) }
                    .buttonStyle(.plain).disabled(selectedIndex >= state.presets.count - 1).accessibilityLabel("Next saved sound")
                Button("SAVE") { state.save(asNew: false) }
                    .buttonStyle(.plain).font(RigStyle.caps(10)).padding(10)
                    .background(RigStyle.night).foregroundStyle(RigStyle.gold)
                    .overlay(Rectangle().stroke(RigStyle.gold.opacity(0.5), lineWidth: 1))
                    .disabled(!state.dirty || !state.storeReadable || state.loading)
                    .accessibilityLabel("Save current preset")
            }
        }.padding(.horizontal, 14).padding(.vertical, 8).background(RigStyle.tolex)
            .overlay(alignment: .bottom) { Rectangle().fill(RigStyle.gold).frame(height: 2) }
    }
    private var ampFace: some View {
        VStack(spacing: 6) {
            ZStack {
                AmpGrille()
                HStack {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("BENNIKS").font(RigStyle.pixel(36)).foregroundStyle(RigStyle.bone)
                        Text("DELUXE REVERB").font(RigStyle.caps(9)).foregroundStyle(RigStyle.gold)
                    }.padding(.horizontal, 14).padding(.vertical, 6).background(RigStyle.tolex)
                        .overlay(Rectangle().stroke(RigStyle.gold, lineWidth: 1))
                    Spacer()
                    VStack(alignment: .trailing, spacing: 5) {
                        Rectangle().fill(state.running && !state.muted ? RigStyle.frets[0] : RigStyle.dust).frame(width: 8, height: 8)
                        Text(state.muted ? "MUTED" : state.running ? "LIVE" : "STANDBY").font(RigStyle.caps(9))
                    }.padding(8).background(RigStyle.night)
                }.padding(.horizontal, 14)
            }.frame(height: 64)
            Picker("Amp and cabinet capture", selection: $state.draft.modelFile) {
                ForEach(state.captures) { Text("\($0.category) / \($0.displayName)").tag($0.modelFile) }
            }.labelsHidden().disabled(state.loading)
                .onChange(of: state.draft.modelFile) { _, _ in if state.running && !state.loading { state.loadSound() } }
                .help("Amp and cabinet capture")
        }
    }
    private var ampDials: some View {
        HStack(spacing: 4) {
            RigDial(title: "INPUT", label: "Input gain", value: $state.draft.input, range: -24...24, diameter: 56)
            RigDial(title: "GATE", label: "Amp gate", value: $state.draft.gate, range: -85 ... -30, diameter: 56)
            RigDial(title: "OUTPUT", label: "Output level", value: $state.draft.output, range: -60...6, emphasized: true, diameter: 56)
        }.padding(.vertical, 6).padding(.horizontal, 8).background(RigStyle.raised).disabled(state.loading)
            .onChange(of: state.draft.input) { _, _ in state.updateControls() }
            .onChange(of: state.draft.gate) { _, _ in state.updateControls() }
            .onChange(of: state.draft.output) { _, _ in state.updateControls() }
    }
    private var cabinet: some View {
        VStack(spacing: 0) {
            // Handle and feet use the same square construction as the note stage.
            Rectangle().stroke(RigStyle.dust, lineWidth: 3).frame(width: 94, height: 9).padding(.top, 3)
            VStack(spacing: 0) {
                ViewThatFits(in: .horizontal) {
                    HStack(spacing: 12) {
                        ampFace.frame(width: 235)
                        ampDials
                    }.frame(minWidth: 700)
                    VStack(spacing: 0) {
                        ampFace
                        Rectangle().fill(RigStyle.gold).frame(height: 3)
                        ampDials
                    }
                }
            }.padding(6).background(RigStyle.tolex).clipShape(PixelFrame())
                .overlay(PixelFrame().stroke(RigStyle.gold.opacity(0.65), lineWidth: 2))
            HStack { Rectangle().frame(width: 38, height: 5); Spacer(); Rectangle().frame(width: 38, height: 5) }
                .foregroundStyle(RigStyle.raised).padding(.horizontal, 28)
        }
    }
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            cabinet
            RigEffectsView(state: state)
            DisclosureGroup("SAVE / MIDI MAPPING") {
                VStack(alignment: .leading, spacing: 12) {
                    HStack(alignment: .bottom, spacing: 16) {
                        VStack(alignment: .leading, spacing: 6) {
                            RigCaption(text: "PRESET NAME")
                            TextField("Name your sound", text: $state.draft.name).textFieldStyle(.plain)
                                .padding(8).background(RigStyle.night).overlay(Rectangle().stroke(RigStyle.raised, lineWidth: 2))
                        }
                        VStack(alignment: .leading, spacing: 6) {
                            RigCaption(text: "MIDI PROGRAM")
                            Picker("MIDI program number, zero based", selection: $state.draft.program) {
                                ForEach(0..<128, id: \.self) { Text("\($0)").tag($0) }
                            }.labelsHidden().frame(width: 90)
                        }
                    }
                    HStack(spacing: 12) {
                        Button("Save preset") { state.save(asNew: false) }.buttonStyle(StompButton())
                        Button("Save as new") { state.save(asNew: true) }.buttonStyle(StompButton())
                    }.disabled(!state.storeReadable)
                    Text("Programs run from 0–127. Give a new sound an unused program before saving.")
                        .font(RigStyle.body(14)).foregroundStyle(RigStyle.dust).fixedSize(horizontal: false, vertical: true)
                }.padding(.top, 10)
            }
            if !state.presetStatus.isEmpty {
                Text(state.presetStatus).font(RigStyle.body(14)).foregroundStyle(RigStyle.dust)
                    .fixedSize(horizontal: false, vertical: true)
            }
            DisclosureGroup("MODEL FOLDER") {
                VStack(alignment: .leading, spacing: 10) {
                    Text(state.modelsDirectory.path).font(RigStyle.body(14)).textSelection(.enabled)
                    Text("Your 48 kHz Deluxe Reverb amp-and-cab captures.").font(RigStyle.body(14)).foregroundStyle(RigStyle.dust)
                    Button("Choose folder") { state.chooseModels() }.buttonStyle(StompButton()).disabled(state.running || state.starting)
                    RigProcessingTime(live: state.live)
                }.padding(.top, 8)
            }
            Text(state.midiStatus).font(RigStyle.body(14)).foregroundStyle(RigStyle.dust)
        }.tint(RigStyle.gold).pickerStyle(.menu).padding(4)
    }
}
