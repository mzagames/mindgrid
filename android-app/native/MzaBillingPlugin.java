package com.mzagaming.mindgrid;

import android.content.Context;
import android.content.SharedPreferences;

import com.android.billingclient.api.AcknowledgePurchaseParams;
import com.android.billingclient.api.BillingClient;
import com.android.billingclient.api.BillingClientStateListener;
import com.android.billingclient.api.BillingFlowParams;
import com.android.billingclient.api.BillingResult;
import com.android.billingclient.api.PendingPurchasesParams;
import com.android.billingclient.api.ProductDetails;
import com.android.billingclient.api.Purchase;
import com.android.billingclient.api.PurchasesUpdatedListener;
import com.android.billingclient.api.QueryProductDetailsParams;
import com.android.billingclient.api.QueryPurchasesParams;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.Collections;
import java.util.List;

/**
 * MindGrid's one-time "Remove ads" purchase (Google Play Billing 9). Copied into the generated Capacitor
 * project by android-app/scripts/patch-android.mjs and registered in MainActivity.
 *
 * JS: Capacitor.Plugins.MzaBilling.getState() / buy() / restore(), and the "changed" event
 * {owned, price, available, busy, message}. On every start the owned purchases are asked from Google Play,
 * so the purchase comes back after a reinstall and a refund turns ads back on. Purchases are acknowledged;
 * a failed acknowledgement is retried on the next start. The last answer is kept for offline launches.
 */
@CapacitorPlugin(name = "MzaBilling")
public class MzaBillingPlugin extends Plugin implements PurchasesUpdatedListener {
    public static final String PRODUCT_ID = "remove_ads";
    private SharedPreferences prefs;
    private BillingClient client;
    private ProductDetails details;
    private String price = "";
    private boolean busy, restoreAsked, starting;

    @Override
    public void load() {
        prefs = getContext().getSharedPreferences("mza_remove_ads", Context.MODE_PRIVATE);
        connect();
    }

    private boolean owned() { return prefs.getBoolean("owned", false); }

    private void setOwned(boolean value) {
        if (value == owned()) return;
        prefs.edit().putBoolean("owned", value).apply();
        emit(null);
    }

    private JSObject state() {
        JSObject o = new JSObject();
        o.put("owned", owned());
        o.put("price", price);
        o.put("available", details != null && client != null && client.isReady());
        o.put("busy", busy);
        o.put("productId", PRODUCT_ID);
        return o;
    }

    private void emit(String message) {
        JSObject o = state();
        if (message != null) o.put("message", message);
        notifyListeners("changed", o, true);
    }

    private void connect() {
        if (starting || client != null && client.isReady()) return;
        starting = true;
        if (client == null) {
            client = BillingClient.newBuilder(getContext())
                    .setListener(this)
                    .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
                    .enableAutoServiceReconnection()
                    .build();
        }
        try {
            client.startConnection(new BillingClientStateListener() {
                @Override public void onBillingSetupFinished(BillingResult result) {
                    starting = false;
                    if (result.getResponseCode() != BillingClient.BillingResponseCode.OK) { emit(null); return; }
                    queryProduct();
                    queryOwned();
                }
                @Override public void onBillingServiceDisconnected() { starting = false; emit(null); }
            });
        } catch (RuntimeException e) {
            starting = false; // no Google Play on this device
        }
    }

    private void queryProduct() {
        if (client == null || !client.isReady()) return;
        QueryProductDetailsParams params = QueryProductDetailsParams.newBuilder()
                .setProductList(Collections.singletonList(QueryProductDetailsParams.Product.newBuilder()
                        .setProductId(PRODUCT_ID).setProductType(BillingClient.ProductType.INAPP).build()))
                .build();
        client.queryProductDetailsAsync(params, (result, found) -> {
            if (result.getResponseCode() != BillingClient.BillingResponseCode.OK || found == null) return;
            for (ProductDetails d : found.getProductDetailsList()) {
                if (!PRODUCT_ID.equals(d.getProductId())) continue;
                details = d;
                ProductDetails.OneTimePurchaseOfferDetails offer = d.getOneTimePurchaseOfferDetails();
                price = offer != null ? offer.getFormattedPrice() : "";
            }
            emit(null);
        });
    }

    private void queryOwned() {
        if (client == null || !client.isReady()) return;
        client.queryPurchasesAsync(QueryPurchasesParams.newBuilder().setProductType(BillingClient.ProductType.INAPP).build(), (result, purchases) -> {
            boolean asked = restoreAsked;
            restoreAsked = false;
            if (result.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                if (asked) emit("Couldn't reach Google Play. Check your connection and try again.");
                return;
            }
            boolean had = owned(), found = false, pending = false;
            for (Purchase p : purchases) {
                if (!p.getProducts().contains(PRODUCT_ID)) continue;
                if (p.getPurchaseState() == Purchase.PurchaseState.PURCHASED) found = true;
                else if (p.getPurchaseState() == Purchase.PurchaseState.PENDING) pending = true;
                handle(p, false);
            }
            if (!found && !pending) setOwned(false); // refunded, or not bought on this Google account
            if (asked) {
                if (found) emit(had ? "Your purchase is active. Ads are off." : "Purchase restored. Ads are off for good.");
                else if (pending) emit("Your payment is still pending in Google Play. Ads turn off as soon as it completes.");
                else emit("No \"Remove ads\" purchase was found for the Google account on this phone.");
            }
        });
    }

    private void handle(Purchase p, boolean fresh) {
        if (!p.getProducts().contains(PRODUCT_ID)) return;
        if (p.getPurchaseState() == Purchase.PurchaseState.PENDING) {
            if (fresh) emit("Your payment is pending. Ads turn off as soon as Google Play confirms it.");
            return;
        }
        if (p.getPurchaseState() != Purchase.PurchaseState.PURCHASED) return;
        boolean was = owned();
        setOwned(true);
        if (fresh && !was) emit("Thank you! Ads are off for good.");
        if (!p.isAcknowledged() && client != null && client.isReady()) {
            client.acknowledgePurchase(AcknowledgePurchaseParams.newBuilder().setPurchaseToken(p.getPurchaseToken()).build(), r -> { });
        }
    }

    @Override
    public void onPurchasesUpdated(BillingResult result, List<Purchase> purchases) {
        busy = false;
        int code = result.getResponseCode();
        if (code == BillingClient.BillingResponseCode.OK && purchases != null) {
            for (Purchase p : purchases) handle(p, true);
            emit(null);
        } else if (code == BillingClient.BillingResponseCode.ITEM_ALREADY_OWNED) {
            restoreAsked = true;
            queryOwned();
        } else if (code == BillingClient.BillingResponseCode.USER_CANCELED) {
            emit(null);
        } else {
            emit("The purchase didn't go through. You haven't been charged.");
        }
    }

    @PluginMethod
    public void getState(PluginCall call) {
        connect();
        call.resolve(state());
    }

    @PluginMethod
    public void buy(PluginCall call) {
        if (owned()) { call.resolve(state()); emit("Ads are already removed. Thank you!"); return; }
        if (details == null || client == null || !client.isReady() || getActivity() == null) {
            connect();
            call.resolve(state());
            emit("Google Play isn't reachable right now. Check your connection and try again.");
            return;
        }
        getActivity().runOnUiThread(() -> {
            BillingFlowParams.ProductDetailsParams.Builder item = BillingFlowParams.ProductDetailsParams.newBuilder().setProductDetails(details);
            List<ProductDetails.OneTimePurchaseOfferDetails> offers = details.getOneTimePurchaseOfferDetailsList();
            if (offers != null && !offers.isEmpty() && offers.get(0).getOfferToken() != null) item.setOfferToken(offers.get(0).getOfferToken());
            BillingResult r = client.launchBillingFlow(getActivity(), BillingFlowParams.newBuilder()
                    .setProductDetailsParamsList(Collections.singletonList(item.build())).build());
            if (r.getResponseCode() == BillingClient.BillingResponseCode.OK) busy = true;
            else if (r.getResponseCode() == BillingClient.BillingResponseCode.ITEM_ALREADY_OWNED) { restoreAsked = true; queryOwned(); }
            else emit("The purchase couldn't start. Please try again in a moment.");
            call.resolve(state());
        });
    }

    @PluginMethod
    public void restore(PluginCall call) {
        if (client == null || !client.isReady()) {
            connect();
            call.resolve(state());
            emit("Connecting to Google Play… Tap Restore purchase again in a moment.");
            return;
        }
        restoreAsked = true;
        queryOwned();
        call.resolve(state());
    }

    @Override
    protected void handleOnDestroy() {
        if (client != null) client.endConnection();
        client = null;
    }
}
