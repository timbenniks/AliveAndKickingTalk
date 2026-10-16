import SwiftUI
import CoreAudio

struct RigRouteControls: View {
    @ObservedObject var state: RigState
    var body: some View {
        HStack(alignment: .top, spacing: 20) {
            VStack(alignment: .leading, spacing: 6) {
                RigCaption(text: "AUDIO OUTPUT")
                Picker("Audio output", selection: $state.output) {
                    Text("Select audio output").tag(AudioDeviceID(0))
                    ForEach(state.outputs) { Text($0.name).tag($0.id) }
                }.labelsHidden()
            }.frame(maxWidth: .infinity, alignment: .leading)
            VStack(alignment: .leading, spacing: 6) {
                RigCaption(text: "BUFFER / 48 KHZ")
                Picker("Audio buffer", selection: $state.buffer) {
                    ForEach([64, 128, 256], id: \.self) { Text("\($0) samples").tag($0) }
                }.labelsHidden().frame(width: 150)
            }
        }.pickerStyle(.menu).padding(12).background(RigStyle.tolex)
    }
}

// A drawn dial with native keyboard focus and VoiceOver adjustment. Drag vertically
// for a full sweep over 240 points; arrow keys adjust by half a unit.
struct RigDial: View {
    let title: String
    let label: String
    @Binding var value: Double
    let range: ClosedRange<Double>
    var suffix = " dB"
    var emphasized = false
    @State private var dragStart: Double?
    @FocusState private var focused: Bool
    @Environment(\.isEnabled) private var enabled
    private var fraction: Double { (value - range.lowerBound) / (range.upperBound - range.lowerBound) }
    private var accent: Color { emphasized ? RigStyle.gold : RigStyle.bone }
    private func set(_ next: Double) { value = min(range.upperBound, max(range.lowerBound, (next * 2).rounded() / 2)) }
    var body: some View {
        VStack(spacing: 3) {
            Text(title).font(RigStyle.caps(10)).foregroundStyle(accent)
            Canvas { context, _ in
                context.scaleBy(x: 0.85, y: 0.85)
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
            }.frame(width: 68, height: 68).contentShape(Rectangle())
            Text("\(value, specifier: "%.1f")\(suffix)").font(RigStyle.body(17)).monospacedDigit().foregroundStyle(accent)
        }.frame(maxWidth: .infinity).opacity(enabled ? 1 : 0.45)
            .contentShape(Rectangle()).focusable().focused($focused).focusEffectDisabled()
            .gesture(DragGesture(minimumDistance: 1).onChanged { event in
                guard enabled else { return }
                focused = true
                if dragStart == nil { dragStart = value }
                set((dragStart ?? value) - Double(event.translation.height) * (range.upperBound - range.lowerBound) / 240)
            }.onEnded { _ in dragStart = nil })
            .onKeyPress(.upArrow) { guard enabled else { return .ignored }; set(value + 0.5); return .handled }
            .onKeyPress(.rightArrow) { guard enabled else { return .ignored }; set(value + 0.5); return .handled }
            .onKeyPress(.downArrow) { guard enabled else { return .ignored }; set(value - 0.5); return .handled }
            .onKeyPress(.leftArrow) { guard enabled else { return .ignored }; set(value - 0.5); return .handled }
            .accessibilityElement(children: .ignore).accessibilityLabel(label)
            .accessibilityValue("\(value, specifier: "%.1f")\(suffix)")
            .accessibilityAdjustableAction { direction in
                guard enabled else { return }
                if direction == .increment { set(value + 0.5) }
                if direction == .decrement { set(value - 0.5) }
            }
            .help("\(label): drag up or down, or use arrow keys for 0.5 steps.")
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
    private var soundSelector: some View {
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
            }
        }.padding(.horizontal, 14).padding(.vertical, 8).background(RigStyle.tolex)
            .overlay(alignment: .bottom) { Rectangle().fill(RigStyle.gold).frame(height: 2) }
    }
    private var cabinet: some View {
        VStack(spacing: 0) {
            // Handle and feet use the same square construction as the note stage.
            Rectangle().stroke(RigStyle.dust, lineWidth: 3).frame(width: 94, height: 9).padding(.top, 3)
            VStack(spacing: 0) {
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
                Rectangle().fill(RigStyle.gold).frame(height: 3)
                HStack(spacing: 4) {
                    RigDial(title: "INPUT", label: "Input gain", value: $state.draft.input, range: -24...24)
                    RigDial(title: "GATE", label: "Amp gate", value: $state.draft.gate, range: -85 ... -30)
                    RigDial(title: "SPRING", label: "Spring reverb", value: $state.draft.reverb, range: 0...10, suffix: "")
                    RigDial(title: "OUTPUT", label: "Output level", value: $state.draft.output, range: -60...6, emphasized: true)
                }.padding(.vertical, 6).padding(.horizontal, 8).background(RigStyle.raised).disabled(state.loading)
                    .onChange(of: state.draft.input) { _, _ in state.updateControls() }
                    .onChange(of: state.draft.gate) { _, _ in state.updateControls() }
                    .onChange(of: state.draft.reverb) { _, _ in state.updateControls() }
                    .onChange(of: state.draft.output) { _, _ in state.updateControls() }
            }.padding(6).background(RigStyle.tolex).clipShape(PixelFrame())
                .overlay(PixelFrame().stroke(RigStyle.gold.opacity(0.65), lineWidth: 2))
            HStack { Rectangle().frame(width: 38, height: 5); Spacer(); Rectangle().frame(width: 38, height: 5) }
                .foregroundStyle(RigStyle.raised).padding(.horizontal, 28)
        }
    }
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            soundSelector
            cabinet
            HStack(spacing: 12) {
                VStack(alignment: .leading, spacing: 3) {
                    RigCaption(text: "AMP + CAB CAPTURE")
                    Picker("Amp and cabinet capture", selection: $state.draft.modelFile) {
                        ForEach(state.captures) { Text("\($0.category) / \($0.displayName)").tag($0.modelFile) }
                    }.labelsHidden().disabled(state.loading)
                        .onChange(of: state.draft.modelFile) { _, _ in if state.running && !state.loading { state.loadSound() } }
                }.frame(maxWidth: .infinity, alignment: .leading)
                Button(state.muted ? "Unmute" : "Mute amp") { state.muted.toggle() }
                    .buttonStyle(StompButton()).accessibilityLabel(state.muted ? "Unmute amp output" : "Mute amp output; keep detecting notes")
            }
            if state.running {
                Text("Playing: \(state.activeName)").font(RigStyle.body(14)).foregroundStyle(RigStyle.gold)
            }
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
            DisclosureGroup("AUDIO / MODEL SETUP") {
                VStack(alignment: .leading, spacing: 10) {
                    RigRouteControls(state: state).disabled(state.running || state.starting)
                    DisclosureGroup("MODEL FOLDER") {
                        VStack(alignment: .leading, spacing: 10) {
                            Text(state.modelsDirectory.path).font(RigStyle.body(14)).textSelection(.enabled)
                            Text("Uses your existing 48 kHz Deluxe Reverb amp-and-cab captures. Purchased model files stay outside the project.")
                                .font(RigStyle.body(14)).foregroundStyle(RigStyle.dust)
                            Button("Choose folder") { state.chooseModels() }.buttonStyle(StompButton()).disabled(state.running || state.starting)
                        }.padding(.top, 8)
                    }.font(RigStyle.body(14))
                    Text("48 kHz · \(state.actualBuffer > 0 ? state.actualBuffer : state.buffer) samples · amp processing \(state.audioMS, specifier: "%.2f") ms")
                        .font(RigStyle.body(14)).foregroundStyle(RigStyle.dust)
                }.padding(.top, 8)
            }
            Text(state.midiStatus).font(RigStyle.body(14)).foregroundStyle(RigStyle.dust)
        }.tint(RigStyle.gold).pickerStyle(.menu).padding(4)
    }
}
