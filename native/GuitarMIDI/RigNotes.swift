import SwiftUI

struct RigReadings: Equatable {
    var pitches: [Int] = []
    var inference = 0.0
    var inputDB: Float = -120
    var dropped = 0
    var audioMS = 0.0
}

// Live readings deliberately do not publish through RigState. Only the monitor
// and processing-time readout observe them; controls and the amp stay independent.
final class RigLiveState: ObservableObject {
    @Published private(set) var readings = RigReadings()
    private var lastMeterUpdate = -Double.infinity
    func update(pitches: [Int], inference: Double, inputDB: Float, dropped: Int, audioMS: Double = 0,
                now: Double = ProcessInfo.processInfo.systemUptime) {
        // Notes and releases are immediate. Unchanged notes need meter updates at
        // most 30 times/sec; this does not throttle detection or outgoing MIDI.
        guard pitches != readings.pitches || now - lastMeterUpdate >= 1.0 / 30 else { return }
        lastMeterUpdate = now
        let next = RigReadings(pitches: pitches, inference: inference, inputDB: inputDB, dropped: dropped, audioMS: audioMS)
        if next != readings { readings = next }
    }
    func clearNotes() { if !readings.pitches.isEmpty { readings.pitches = [] } }
    func reset() { lastMeterUpdate = -Double.infinity; if readings != RigReadings() { readings = RigReadings() } }
}

struct RigNoteMonitor: View {
    @ObservedObject var live: RigLiveState
    private var reading: RigReadings { live.readings }
    var body: some View {
        VStack(spacing: 12) {
            HStack(spacing: 16) {
                VoxelStage(pitches: reading.pitches).frame(width: 180, height: 102)
                VStack(alignment: .leading, spacing: 4) {
                    RigCaption(text: "LIVE NOTES")
                    Text(String(format: "%02d", reading.pitches.count)).font(RigStyle.pixel(44)).foregroundStyle(RigStyle.gold)
                        .frame(width: 90, height: 40, alignment: .leading)
                    Text(reading.pitches.isEmpty ? "Waiting for guitar" : reading.pitches.count > 12 ? "+\(reading.pitches.count - 12) more notes" : "Notes → MIDI")
                        .font(RigStyle.body(16)).foregroundStyle(RigStyle.dust).lineLimit(1)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
            }.frame(height: 102)
            // Stable identities and two permanently reserved rows. Silence, a
            // chord and overflow have exactly the same layout footprint.
            VStack(spacing: 6) {
                ForEach(0..<2) { row in
                    HStack(spacing: 6) {
                        ForEach(0..<6) { column in
                            let slot = row * 6 + column
                            let pitch = reading.pitches.indices.contains(slot) ? reading.pitches[slot] : nil
                            let color = pitch.map { RigStyle.frets[RigStyle.lane($0)] } ?? RigStyle.raised
                            Text(pitch.map(noteName) ?? "—")
                                .font(RigStyle.pixel(26)).foregroundStyle(pitch == nil ? RigStyle.dust.opacity(0.4) : color)
                                .frame(maxWidth: .infinity).frame(height: 32).background(RigStyle.night)
                                .overlay(alignment: .bottom) { Rectangle().fill(color).frame(height: 2) }
                        }
                    }
                }
            }.frame(height: 70).accessibilityElement(children: .ignore)
                .accessibilityLabel("Detected notes: \(reading.pitches.isEmpty ? "none" : reading.pitches.map(noteName).joined(separator: ", "))")
            HStack(spacing: 14) {
                VStack(alignment: .leading, spacing: 6) {
                    Text("INPUT  \(Int(reading.inputDB)) dB").font(RigStyle.caps(9)).foregroundStyle(RigStyle.dust)
                        .lineLimit(1).frame(height: 12, alignment: .leading)
                    HStack(spacing: 3) {
                        ForEach(0..<20) { i in
                            Rectangle().fill(Double(reading.inputDB) > -70 + Double(i)*3.5 ? (i > 17 ? RigStyle.frets[1] : RigStyle.gold) : RigStyle.raised)
                        }
                    }.frame(height: 8)
                }.frame(maxWidth: .infinity).accessibilityElement(children: .ignore)
                    .accessibilityLabel("Input level \(Int(reading.inputDB)) decibels")
                VStack(alignment: .leading, spacing: 2) {
                    RigCaption(text: "INFERENCE")
                    Text("\(reading.inference, specifier: "%.1f") ms").font(RigStyle.pixel(23)).monospacedDigit()
                }.frame(width: 84, alignment: .leading)
                VStack(alignment: .leading, spacing: 2) {
                    RigCaption(text: "DROPS")
                    Text("\(reading.dropped)").font(RigStyle.pixel(23)).monospacedDigit()
                        .foregroundStyle(reading.dropped > 0 ? RigStyle.gold : RigStyle.bone)
                }.frame(width: 62, alignment: .leading)
            }.frame(height: 42).lineLimit(1).minimumScaleFactor(0.6)
        }.padding(14).frame(height: 266).background(RigStyle.tolex)
            .overlay(Rectangle().stroke(RigStyle.raised, lineWidth: 2))
            .transaction { $0.animation = nil }
    }
}

struct RigProcessingTime: View {
    @ObservedObject var live: RigLiveState
    var body: some View {
        Text("Amp processing \(live.readings.audioMS, specifier: "%.2f") ms (not total latency)")
            .font(RigStyle.body(14)).foregroundStyle(RigStyle.dust)
    }
}
