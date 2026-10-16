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
        }.pickerStyle(.menu).padding(16).background(RigStyle.tolex)
    }
}

struct RigAmpControls: View {
    @ObservedObject var state: RigState
    func knob(_ title: String, value: Binding<Double>, range: ClosedRange<Double>, suffix: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack { Text(title); Spacer(); Text("\(value.wrappedValue, specifier: "%.1f")\(suffix)").foregroundStyle(RigStyle.gold) }
            Slider(value: value, in: range, step: 0.5).accessibilityLabel(title)
                .onChange(of: value.wrappedValue) { _, _ in state.updateControls() }
        }
    }
    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                VStack(alignment: .leading, spacing: 3) {
                    Text("YOUR SOUND").font(RigStyle.pixel(30)).foregroundStyle(RigStyle.gold)
                    Text(state.running ? "ACTIVE / \(state.activeName)" : "Choose a sound, then start the rig.")
                        .font(RigStyle.body(14)).foregroundStyle(RigStyle.dust)
                }
                Spacer()
                Button(state.muted ? "Unmute amp" : "Mute amp") { state.muted.toggle() }
                    .buttonStyle(StompButton()).accessibilityLabel(state.muted ? "Unmute amp output" : "Mute amp output; keep detecting notes")
            }
            HStack {
                Text("Saved sound")
                Picker("Saved sound", selection: Binding(get: { state.selected }, set: { state.selectPreset($0) })) {
                    ForEach(state.presets) { Text("\($0.program) · \($0.name)").tag($0.id) }
                }.labelsHidden()
                if state.dirty { Text("EDITED").font(RigStyle.caps(9)).foregroundStyle(RigStyle.gold) }
            }
            HStack {
                Text("Amp + cabinet")
                Picker("Amp and cabinet capture", selection: $state.draft.modelFile) {
                    ForEach(state.captures) { Text("\($0.category) / \($0.displayName)").tag($0.modelFile) }
                }.labelsHidden().disabled(state.loading)
                    .onChange(of: state.draft.modelFile) { _, _ in if state.running && !state.loading { state.loadSound() } }
            }
            LazyVGrid(columns: [GridItem(.flexible(), spacing: 20), GridItem(.flexible())], spacing: 10) {
                knob("Input gain", value: $state.draft.input, range: -24...24, suffix: " dB")
                knob("Output level", value: $state.draft.output, range: -60...6, suffix: " dB")
                knob("Amp gate", value: $state.draft.gate, range: -85 ... -30, suffix: " dB")
                knob("Spring reverb", value: $state.draft.reverb, range: 0...10, suffix: "")
            }.disabled(state.loading)
            Rectangle().fill(RigStyle.raised).frame(height: 2)
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
            Text(state.presetStatus.isEmpty ? "Programs run from 0–127. Give a new sound an unused program before saving." : state.presetStatus)
                .font(RigStyle.body(14)).foregroundStyle(RigStyle.dust).fixedSize(horizontal: false, vertical: true)
            Text(state.midiStatus).font(RigStyle.body(14)).foregroundStyle(RigStyle.gold)
            DisclosureGroup("MODEL FOLDER") {
                VStack(alignment: .leading, spacing: 10) {
                    Text(state.modelsDirectory.path).font(RigStyle.body(14)).textSelection(.enabled)
                    Text("Uses your existing 48 kHz Deluxe Reverb amp-and-cab captures. Purchased model files stay outside the project.")
                        .font(RigStyle.body(14)).foregroundStyle(RigStyle.dust)
                    Button("Choose folder") { state.chooseModels() }.buttonStyle(StompButton()).disabled(state.running || state.starting)
                }.padding(.top, 8)
            }.font(RigStyle.body(14))
        }.tint(RigStyle.gold).pickerStyle(.menu).padding(18)
            .background(RigStyle.tolex).overlay(Rectangle().stroke(RigStyle.raised, lineWidth: 2))
    }
}
