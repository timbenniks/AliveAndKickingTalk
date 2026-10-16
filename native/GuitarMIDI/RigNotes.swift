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
            VoxelStage(pitches: reading.pitches)
                .aspectRatio(360.0 / 204.0, contentMode: .fit)
                .frame(maxWidth: .infinity).frame(height: 176)
            HStack(spacing: 8) {
                Text("LIVE NOTES").font(RigStyle.caps(8)).foregroundStyle(RigStyle.dust)
                Text(String(format: "%02d", reading.pitches.count)).font(RigStyle.pixel(28)).foregroundStyle(RigStyle.gold)
                    .frame(width: 32, alignment: .leading)
                Spacer(minLength: 0)
                Text(reading.pitches.isEmpty ? "Waiting for guitar" : reading.pitches.count > 6 ? "+\(reading.pitches.count - 6) more notes" : "Notes → MIDI")
                    .font(RigStyle.body(13)).foregroundStyle(RigStyle.dust).lineLimit(1).minimumScaleFactor(0.8)
            }.frame(height: 26)
            // Stable identities and one permanently reserved row. Silence, a
            // chord and overflow have exactly the same layout footprint.
            HStack(spacing: 6) {
                ForEach(0..<6) { slot in
                    let pitch = reading.pitches.indices.contains(slot) ? reading.pitches[slot] : nil
                    let color = pitch.map { RigStyle.frets[RigStyle.lane($0)] } ?? RigStyle.raised
                    Text(pitch.map(noteName) ?? "—")
                        .font(RigStyle.pixel(26)).foregroundStyle(pitch == nil ? RigStyle.dust.opacity(0.4) : color)
                        .lineLimit(1).minimumScaleFactor(0.55)
                        .frame(maxWidth: .infinity).frame(height: 32).background(RigStyle.night)
                        .overlay(alignment: .bottom) { Rectangle().fill(color).frame(height: 2) }
                }
            }.frame(height: 32).accessibilityElement(children: .ignore)
                .accessibilityLabel("Detected notes: \(reading.pitches.isEmpty ? "none" : reading.pitches.map(noteName).joined(separator: ", "))")
            HStack(spacing: 8) {
                VStack(alignment: .leading, spacing: 6) {
                    Text("IN \(Int(reading.inputDB)) dB").font(RigStyle.caps(8)).foregroundStyle(RigStyle.dust)
                        .lineLimit(1).frame(height: 12, alignment: .leading)
                    HStack(spacing: 3) {
                        ForEach(0..<20) { i in
                            Rectangle().fill(Double(reading.inputDB) > -70 + Double(i)*3.5 ? (i > 17 ? RigStyle.frets[1] : RigStyle.gold) : RigStyle.raised)
                        }
                    }.frame(height: 8)
                }.frame(maxWidth: .infinity).accessibilityElement(children: .ignore)
                    .accessibilityLabel("Input level \(Int(reading.inputDB)) decibels")
                VStack(alignment: .leading, spacing: 2) {
                    Text("INFERENCE").font(RigStyle.caps(8)).foregroundStyle(RigStyle.dust)
                    Text("\(reading.inference, specifier: "%.1f") ms").font(RigStyle.pixel(23)).monospacedDigit()
                }.frame(width: 70, alignment: .leading)
                VStack(alignment: .leading, spacing: 2) {
                    Text("DROPS").font(RigStyle.caps(8)).foregroundStyle(RigStyle.dust)
                    Text("\(reading.dropped)").font(RigStyle.pixel(23)).monospacedDigit()
                        .foregroundStyle(reading.dropped > 0 ? RigStyle.gold : RigStyle.bone)
                }.frame(width: 48, alignment: .leading)
            }.frame(height: 42).lineLimit(1).minimumScaleFactor(0.6)
        }.padding(14).frame(height: 340).background(RigStyle.tolex)
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
