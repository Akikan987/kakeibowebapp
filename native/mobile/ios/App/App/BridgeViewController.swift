import Capacitor

/// Registers the app-specific bridge plugin before the web app starts calling it.
final class BridgeViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(KakeiboDevicePlugin())
    }
}
