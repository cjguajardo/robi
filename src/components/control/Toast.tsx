// Ark UI-based toast system — accessible, animated, dismissable.
// Singleton toaster keeps the API ergonomic from anywhere.

import { createToaster, Toast, Toaster } from "@ark-ui/react/toast";
import { Portal } from "@ark-ui/react/portal";

export interface ToastInput {
  title: string;
  description?: string;
  type?: "info" | "success" | "warning" | "error";
  duration?: number;
}

export const toaster = createToaster({
  placement: "bottom",
  overlap: false,
  gap: 12,
  duration: 2500,
});

export function pushToast(input: ToastInput) {
  toaster.create({
    title: input.title,
    description: input.description,
    type: input.type ?? "info",
    duration: input.duration ?? 2500,
  });
}

export function ToastViewport() {
  return (
    <Portal>
      <Toaster toaster={toaster} className="toaster">
        {(toast) => (
          <Toast.Root key={toast.id} className={`toast toast-${toast.type}`}>
            <Toast.Title className="toast-title">{toast.title}</Toast.Title>
            {toast.description && (
              <Toast.Description className="toast-desc">{toast.description}</Toast.Description>
            )}
          </Toast.Root>
        )}
      </Toaster>
    </Portal>
  );
}