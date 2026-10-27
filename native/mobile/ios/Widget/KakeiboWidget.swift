import SwiftUI
import WidgetKit

private let appGroup = "group.com.kakeibodata.kakeibo.nativeapp"
private let snapshotFilename = "widget-snapshot.json"
private let privacyKey = "kakeibo.widget.showAmounts"

private struct KakeiboEntry: TimelineEntry {
    let date: Date
    let snapshot: Snapshot?
    let showAmounts: Bool

    struct Snapshot: Decodable {
        let owner: String
        let monthTotal: Double
        let nextDate: Double?
        let nextAmount: Double
        let updatedAt: Int64
        let lastSync: Int64
        let state: String
        let monthKey: String
    }
}

private struct KakeiboProvider: TimelineProvider {
    func placeholder(in context: Context) -> KakeiboEntry { makeEntry() }
    func getSnapshot(in context: Context, completion: @escaping (KakeiboEntry) -> Void) { completion(makeEntry()) }

    func getTimeline(in context: Context, completion: @escaping (Timeline<KakeiboEntry>) -> Void) {
        let entry = makeEntry()
        completion(Timeline(entries: [entry], policy: .after(Date().addingTimeInterval(60 * 60))))
    }

    private func makeEntry() -> KakeiboEntry {
        let defaults = UserDefaults(suiteName: appGroup)
        var snapshot: KakeiboEntry.Snapshot?
        if let directory = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroup) {
            let url = directory.appendingPathComponent(snapshotFilename)
            if let data = try? Data(contentsOf: url) { snapshot = try? JSONDecoder().decode(KakeiboEntry.Snapshot.self, from: data) }
        }
        return KakeiboEntry(date: Date(), snapshot: snapshot, showAmounts: defaults?.bool(forKey: privacyKey) ?? false)
    }
}

private struct KakeiboWidgetView: View {
    @Environment(\.widgetFamily) private var family
    let entry: KakeiboEntry

    private var currentMonthKey: String {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.dateFormat = "yyyy-MM"
        return formatter.string(from: entry.date)
    }

    private var isStale: Bool {
        guard let snapshot = entry.snapshot else { return true }
        return entry.date.timeIntervalSince1970 * 1000 - Double(snapshot.updatedAt) > 86_400_000
    }

    private var canShowAmounts: Bool {
        guard let snapshot = entry.snapshot else { return false }
        return entry.showAmounts && !isStale && snapshot.monthKey == currentMonthKey
    }

    var body: some View {
        Group {
            if let snapshot = entry.snapshot { content(snapshot) } else { emptyState }
        }
        .widgetURL(URL(string: "kakeibo-native://add-expense"))
        .privacySensitive()
    }

    @ViewBuilder private func content(_ snapshot: KakeiboEntry.Snapshot) -> some View {
        let widgetContent = VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("家計簿").font(.headline)
                Spacer()
                if isStale || snapshot.monthKey != currentMonthKey || snapshot.state != "current" {
                    Text(statusLabel(snapshot)).font(.caption2).foregroundColor(.secondary).lineLimit(1)
                }
            }
            if snapshot.monthKey != currentMonthKey {
                Text("今月のデータを更新してください").font(.subheadline).foregroundColor(.secondary)
            } else {
                VStack(alignment: .leading, spacing: 4) {
                    Text("今月の支払予定").font(.caption).foregroundColor(.secondary)
                    amount(snapshot.monthTotal)
                        .font(family == .systemSmall ? .title3.bold() : .title2.bold())
                }
                Spacer(minLength: 0)
                if let nextDate = snapshot.nextDate {
                    HStack {
                        Text("次回引き落とし")
                        Spacer(minLength: 4)
                        Text(Date(timeIntervalSince1970: nextDate / 1000), style: .date)
                        if canShowAmounts { Text(currencyString(snapshot.nextAmount)) }
                    }
                    .font(.caption).lineLimit(1).minimumScaleFactor(0.75)
                } else {
                    Text("次回引き落としの予定はありません").font(.caption).foregroundColor(.secondary).lineLimit(1)
                }
                Text("計算 \(Date(timeIntervalSince1970: Double(snapshot.updatedAt) / 1000), style: .time) / 同期 \(Date(timeIntervalSince1970: Double(snapshot.lastSync) / 1000), style: .date)")
                    .font(.caption2).foregroundColor(.secondary).lineLimit(1)
            }
        }
        .padding()
        if #available(iOSApplicationExtension 17.0, *) {
            widgetContent.containerBackground(.background, for: .widget)
        } else {
            widgetContent
        }
    }

    private var emptyState: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("家計簿").font(.headline)
            Text("アプリを開くとウィジェットが更新されます").font(.caption).foregroundColor(.secondary)
        }
        .padding().frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    }

    @ViewBuilder private func amount(_ value: Double) -> some View {
        if canShowAmounts {
            Text(currencyString(value)).lineLimit(1).minimumScaleFactor(0.65)
        } else {
            Text("••••••").accessibilityLabel("金額は非表示です")
        }
    }

    private func currencyString(_ value: Double) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.locale = .current
        return formatter.string(from: NSNumber(value: value)) ?? "••••"
    }

    private func statusLabel(_ snapshot: KakeiboEntry.Snapshot) -> String {
        if snapshot.monthKey != currentMonthKey { return "月が変わりました" }
        if isStale { return "更新が古いです" }
        switch snapshot.state {
        case "offline": return "オフライン"
        case "error": return "同期エラー"
        default: return "更新待ち"
        }
    }
}

@main
struct KakeiboWidget: Widget {
    let kind = "KakeiboWidget"
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: KakeiboProvider()) { entry in
            KakeiboWidgetView(entry: entry)
        }
        .configurationDisplayName("家計簿")
        .description("今月の支出と次回の引き落としを表示します。")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}
