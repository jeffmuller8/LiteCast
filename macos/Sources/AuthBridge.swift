import AppKit

/// Google sign-in for the Mac app. Google blocks its sign-in page inside embedded web views,
/// so this opens the site's /desktop-sign-in page in the default browser, which signs in with
/// Google and hands the Google ID token back through litecast://auth. The web layer then signs
/// in to Firebase with it (src/lib/auth-context.tsx), like the Android app.
final class AuthBridge {
    private let site: URL
    private var pending: (state: String, reply: (Any?, String?) -> Void)?

    init(site: URL) {
        self.site = site
    }

    func handle(method: String, args: [String: Any], reply: @escaping (Any?, String?) -> Void) {
        switch method {
        case "signInWithGoogle":
            signIn(reply: reply)
        case "signOut":
            reply(nil, nil)
        default:
            reply(nil, "Unknown method \(method)")
        }
    }

    private func signIn(reply: @escaping (Any?, String?) -> Void) {
        // A newer attempt replaces one the user abandoned in the browser
        pending?.reply(nil, "CANCELLED")

        // Random state ties the callback to this attempt, so another page can't sign the app
        // in to a different account by opening a litecast:// link
        var bytes = [UInt8](repeating: 0, count: 24)
        guard SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes) == errSecSuccess else {
            return reply(nil, "Couldn't start sign-in")
        }
        let state = Data(bytes).base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")

        var components = URLComponents(url: site.appendingPathComponent("desktop-sign-in"), resolvingAgainstBaseURL: false)!
        components.queryItems = [URLQueryItem(name: "state", value: state)]
        pending = (state, reply)
        NSWorkspace.shared.open(components.url!)
    }

    /// Returns true if the URL was a sign-in callback for the current attempt.
    func handleCallback(_ url: URL) -> Bool {
        guard url.host == "auth",
              let items = URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems,
              let state = items.first(where: { $0.name == "state" })?.value,
              let pending, pending.state == state
        else { return false }
        self.pending = nil
        if let idToken = items.first(where: { $0.name == "idToken" })?.value, !idToken.isEmpty {
            pending.reply(["idToken": idToken], nil)
        } else {
            pending.reply(nil, items.first(where: { $0.name == "error" })?.value ?? "Sign-in failed")
        }
        return true
    }
}
