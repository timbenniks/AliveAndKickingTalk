import SwiftUI

private struct RackEar: View {
    private var screw: some View {
        ZStack {
            Rectangle().fill(RigStyle.night).frame(width: 12, height: 8)
            Rectangle().fill(RigStyle.dust).frame(width: 6, height: 6)
            Rectangle().fill(RigStyle.night).frame(width: 4, height: 2)
        }
    }
    var body: some View {
        VStack { screw; Spacer(minLength: 12); screw }
            .padding(.vertical, 14).frame(width: 20).background(RigStyle.raised)
            .overlay(alignment: .trailing) { Rectangle().fill(RigStyle.night).frame(width: 2) }
            .accessibilityHidden(true)
    }
}

private struct RackScreen: View {
    let mode: String
    let value: String
    let detail: String
    let color: Color
    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(mode).font(RigStyle.caps(8)).opacity(0.8)
            Text(value).font(RigStyle.pixel(28)).monospacedDigit()
            Text(detail).font(RigStyle.body(13)).monospacedDigit()
        }.lineLimit(1).minimumScaleFactor(0.8)
            .frame(maxWidth: .infinity, alignment: .leading).frame(height: 65)
            .padding(.horizontal, 10).padding(.vertical, 4).foregroundStyle(color)
            .background(RigStyle.night)
            .overlay(Rectangle().stroke(color.opacity(0.35), lineWidth: 1))
            .overlay(alignment: .top) { Rectangle().fill(RigStyle.ink).frame(height: 3) }
            .accessibilityElement(children: .combine)
    }
}

struct RigEffectsView: View {
    @ObservedObject var state: RigState
    @State private var lastTap: Double?
    @State private var intervals: [Double] = []
    @State private var expanded = true
    init(state: RigState, expanded: Bool = true) {
        self.state = state
        _expanded = State(initialValue: expanded)
    }
    private var fx: RigEffectSettings { state.draft.effects }
    private let echoColor = RigStyle.frets[3]
    private let spaceColor = RigStyle.frets[5]
    private var divisionName: String { ["FREE", "1/4", "DOT 1/8", "1/8", "1/2"][fx.division] }
    private func tapTempo() {
        let now = ProcessInfo.processInfo.systemUptime
        if let lastTap, (0.25...1.5).contains(now - lastTap) {
            intervals.append(now - lastTap); intervals = Array(intervals.suffix(4))
            state.draft.effects.tempo = (60 / (intervals.reduce(0, +) / Double(intervals.count))).rounded()
            if fx.division == 0 { state.draft.effects.division = 1 }
        } else { intervals = [] }
        lastTap = now
    }
    private func rack<Content: View>(color: Color, @ViewBuilder content: () -> Content) -> some View {
        HStack(spacing: 0) {
            RackEar()
            VStack(spacing: 10, content: content).padding(12).frame(maxWidth: .infinity)
                .background(RigStyle.tolex)
            RackEar().rotationEffect(.degrees(180))
        }.fixedSize(horizontal: false, vertical: true)
            .overlay(Rectangle().stroke(RigStyle.dust.opacity(0.45), lineWidth: 1))
            .overlay(alignment: .top) { Rectangle().fill(color.opacity(0.7)).frame(height: 2).padding(.horizontal, 20) }
            .overlay(alignment: .bottom) { Rectangle().fill(RigStyle.ink).frame(height: 4) }
            .shadow(color: RigStyle.ink, radius: 0, x: 0, y: 3)
    }
    private func power(_ name: String, _ binding: Binding<Bool>, color: Color) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(name).font(RigStyle.pixel(28)).foregroundStyle(color)
            Button { binding.wrappedValue.toggle() } label: {
                HStack(spacing: 5) {
                    Rectangle().fill(binding.wrappedValue ? color : RigStyle.dust.opacity(0.4)).frame(width: 6, height: 6)
                    Text(binding.wrappedValue ? "ON" : "OFF").font(RigStyle.caps(9))
                }.padding(.horizontal, 8).padding(.vertical, 6)
                    .background(RigStyle.night).overlay(Rectangle().stroke(RigStyle.raised, lineWidth: 2))
            }.buttonStyle(.plain).foregroundStyle(RigStyle.bone)
                .accessibilityLabel("\(name) enabled").accessibilityValue(binding.wrappedValue ? "On" : "Off")
                .help("Off lets existing tails fade out. Mute amp silences everything.")
        }.frame(width: 78, alignment: .leading)
    }
    private func knob(_ title: String, _ label: String, _ value: Binding<Double>, range: ClosedRange<Double> = 0...100,
                      suffix: String = "%", color: Color) -> some View {
        RigDial(title: title, label: label, value: value, range: range, suffix: suffix,
                tint: color, diameter: 48, step: 1, wholeNumbers: true)
    }
    private var echoHeader: some View {
        HStack(spacing: 12) {
            power("ECHO", $state.draft.effects.delayEnabled, color: echoColor)
            RackScreen(mode: "\(fx.delayStyle == 0 ? "DIGITAL" : "TAPE") / \(fx.pingPong ? "PING-PONG" : "STEREO")",
                       value: "\(Int(fx.delayMilliseconds.rounded())) ms",
                       detail: fx.division == 0 ? "FREE · FB \(Int(fx.feedback))%" : "\(divisionName) · \(Int(fx.tempo)) BPM · FB \(Int(fx.feedback))%", color: echoColor)
        }
    }
    private var delaySelectors: some View {
        HStack(spacing: 8) {
            Picker("Delay character", selection: $state.draft.effects.delayStyle) {
                Text("Digital").tag(0); Text("Tape").tag(1)
            }.labelsHidden().frame(width: 85)
            Picker("Delay timing", selection: $state.draft.effects.division) {
                Text("Milliseconds").tag(0); Text("1/4 note").tag(1); Text("Dotted 1/8").tag(2)
                Text("1/8 note").tag(3); Text("1/2 note").tag(4)
            }.labelsHidden().frame(maxWidth: .infinity)
            Button("TAP") { tapTempo() }.buttonStyle(.plain).font(RigStyle.caps(9)).padding(7)
                .background(RigStyle.night).overlay(Rectangle().stroke(echoColor.opacity(0.5), lineWidth: 1))
                .accessibilityLabel("Tap delay tempo")
        }
    }
    private var delayKnobs: some View {
        HStack(spacing: 4) {
            if fx.division == 0 {
                knob("TIME", "Delay time", $state.draft.effects.delayTime, range: 20...2000, suffix: " ms", color: echoColor)
            } else {
                knob("TEMPO", "Delay tempo", $state.draft.effects.tempo, range: 40...240, suffix: " BPM", color: echoColor)
            }
            knob("FEEDBACK", "Delay feedback", $state.draft.effects.feedback, range: 0...85, color: echoColor)
            knob("MIX", "Echo mix", $state.draft.effects.delayMix, range: 0...60, color: echoColor)
            knob("TONE", "Echo tone", $state.draft.effects.delayTone, color: echoColor)
        }
    }
    private var pingPong: some View {
        Toggle("Ping-pong", isOn: $state.draft.effects.pingPong).toggleStyle(.checkbox)
            .font(RigStyle.body(13)).frame(maxWidth: .infinity, alignment: .trailing)
    }
    private var delay: some View {
        rack(color: echoColor) {
            ViewThatFits(in: .horizontal) {
                HStack(spacing: 16) {
                    VStack(spacing: 10) { echoHeader; delaySelectors }.frame(width: 320)
                    VStack(spacing: 10) { delayKnobs; pingPong }
                }.frame(minWidth: 660)
                VStack(spacing: 10) { echoHeader; delaySelectors; delayKnobs; pingPong }
            }
        }
    }
    private var spaceHeader: some View {
        HStack(spacing: 12) {
            power("SPACE", $state.draft.effects.reverbEnabled, color: spaceColor)
            RackScreen(mode: "STEREO REVERB", value: "\(fx.reverbStyle == 0 ? "ROOM" : "HALL") / \(Int(fx.size))%",
                       detail: "PRE \(Int(fx.preDelay)) ms · WIDTH \(Int(fx.width))%", color: spaceColor)
        }
    }
    private var spaceSelector: some View {
        HStack {
            Picker("Space reverb type", selection: $state.draft.effects.reverbStyle) {
                Text("Room").tag(0); Text("Hall").tag(1)
            }.labelsHidden().frame(width: 85)
            Spacer()
            Text("REVERB PROCESSOR").font(RigStyle.caps(8)).foregroundStyle(RigStyle.dust)
        }
    }
    private var spaceKnobs: some View {
        HStack(spacing: 4) {
            knob("LENGTH", "Reverb length", $state.draft.effects.size, color: spaceColor)
            knob("PRE", "Reverb pre-delay", $state.draft.effects.preDelay, range: 0...150, suffix: " ms", color: spaceColor)
            knob("MIX", "Space mix", $state.draft.effects.reverbMix, range: 0...60, color: spaceColor)
            knob("TONE", "Space tone", $state.draft.effects.reverbTone, color: spaceColor)
            knob("WIDTH", "Stereo width", $state.draft.effects.width, color: spaceColor)
        }
    }
    private var space: some View {
        rack(color: spaceColor) {
            ViewThatFits(in: .horizontal) {
                HStack(spacing: 16) {
                    VStack(spacing: 10) { spaceHeader; spaceSelector }.frame(width: 320)
                    spaceKnobs
                }.frame(minWidth: 660)
                VStack(spacing: 10) { spaceHeader; spaceSelector; spaceKnobs }
            }
        }
    }
    var body: some View {
        DisclosureGroup(isExpanded: $expanded) {
            VStack(spacing: 10) {
                delay
                space
                HStack(spacing: 12) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("KEEP THE NOTES CLEAR").font(RigStyle.caps(9)).foregroundStyle(RigStyle.gold)
                        Text("Ducking lowers both effects while you play.")
                            .font(RigStyle.body(14)).foregroundStyle(RigStyle.dust)
                        Text("Save preset to keep your settings.").font(RigStyle.body(13)).foregroundStyle(RigStyle.dust)
                    }.frame(maxWidth: .infinity, alignment: .leading)
                    knob("DUCK", "Effects ducking", $state.draft.effects.ducking, color: RigStyle.gold).frame(width: 64)
                }.padding(.horizontal, 20).padding(.vertical, 6)
            }.padding(.top, 8).disabled(state.loading)
        } label: {
            HStack {
                Text("EFFECTS RACK").font(RigStyle.caps(10)).foregroundStyle(RigStyle.gold)
                Spacer()
                Text("Echo \(fx.delayEnabled ? "on" : "off") · Space \(fx.reverbEnabled ? "on" : "off")")
                    .font(RigStyle.body(14)).foregroundStyle(RigStyle.dust)
            }
        }.padding(.vertical, 8)
            .onChange(of: state.draft.effects) { _, _ in state.updateControls() }
            .onChange(of: state.selected) { _, _ in lastTap = nil; intervals = [] }
    }
}
