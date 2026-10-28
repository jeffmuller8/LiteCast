package com.litecast.app;

import android.os.CancellationSignal;
import androidx.annotation.NonNull;
import androidx.core.content.ContextCompat;
import androidx.credentials.ClearCredentialStateRequest;
import androidx.credentials.Credential;
import androidx.credentials.CredentialManager;
import androidx.credentials.CredentialManagerCallback;
import androidx.credentials.CustomCredential;
import androidx.credentials.GetCredentialRequest;
import androidx.credentials.GetCredentialResponse;
import androidx.credentials.exceptions.ClearCredentialException;
import androidx.credentials.exceptions.GetCredentialCancellationException;
import androidx.credentials.exceptions.GetCredentialException;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption;
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential;

/**
 * Google blocks its sign-in page inside WebViews, so the app signs in with Android's
 * Credential Manager and hands the Google ID token to the web layer, which signs in to
 * Firebase with it (src/lib/auth-context.tsx). The web client ID comes from
 * capacitor.config.json: plugins.LiteCastAuth.webClientId.
 */
@CapacitorPlugin(name = "LiteCastAuth")
public class LiteCastAuthPlugin extends Plugin {

    @PluginMethod
    public void signInWithGoogle(PluginCall call) {
        String clientId = getConfig().getString("webClientId", "");
        if (clientId == null || clientId.isEmpty()) {
            call.reject("Google sign-in isn't set up in the app (missing webClientId)", "NOT_CONFIGURED");
            return;
        }
        GetCredentialRequest request = new GetCredentialRequest.Builder()
            .addCredentialOption(new GetSignInWithGoogleOption.Builder(clientId).build())
            .build();

        CredentialManager.create(getContext()).getCredentialAsync(
            getActivity(),
            request,
            new CancellationSignal(),
            ContextCompat.getMainExecutor(getContext()),
            new CredentialManagerCallback<GetCredentialResponse, GetCredentialException>() {
                @Override
                public void onResult(GetCredentialResponse response) {
                    Credential credential = response.getCredential();
                    if (
                        credential instanceof CustomCredential &&
                        GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL.equals(credential.getType())
                    ) {
                        GoogleIdTokenCredential google = GoogleIdTokenCredential.createFrom(credential.getData());
                        JSObject result = new JSObject();
                        result.put("idToken", google.getIdToken());
                        call.resolve(result);
                    } else {
                        call.reject("Unexpected credential type: " + credential.getType());
                    }
                }

                @Override
                public void onError(@NonNull GetCredentialException e) {
                    if (e instanceof GetCredentialCancellationException) {
                        call.reject("Sign-in was cancelled", "CANCELLED");
                    } else {
                        call.reject(e.getMessage() != null ? e.getMessage() : e.getType(), e.getClass().getSimpleName(), e);
                    }
                }
            }
        );
    }

    // Forget the chosen account so the next sign-in shows the account picker again
    @PluginMethod
    public void signOut(PluginCall call) {
        CredentialManager.create(getContext()).clearCredentialStateAsync(
            new ClearCredentialStateRequest(),
            new CancellationSignal(),
            ContextCompat.getMainExecutor(getContext()),
            new CredentialManagerCallback<Void, ClearCredentialException>() {
                @Override
                public void onResult(Void result) {
                    call.resolve();
                }

                @Override
                public void onError(@NonNull ClearCredentialException e) {
                    call.resolve();
                }
            }
        );
    }
}
