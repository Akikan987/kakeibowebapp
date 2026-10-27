package com.kakeibodata.kakeibo.nativeapp;

import android.content.Context;
import androidx.annotation.NonNull;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

/** Local expiry/redraw only: does not fetch mail, sync data, or recompute bills. */
public final class WidgetMaintenanceWorker extends Worker {
    public WidgetMaintenanceWorker(@NonNull Context context, @NonNull WorkerParameters parameters) { super(context, parameters); }
    @NonNull @Override public Result doWork() {
        Context context = getApplicationContext();
        if (!DeviceState.hasPermission(context)) DeviceState.disable(context);
        new NotificationStore(context).prune();
        PaymentWidget.updateAll(context);
        return Result.success();
    }
}
