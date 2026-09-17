import { Alert, Platform } from "react-native";

export type ConfirmDialogOptions = {
  title: string;
  message: string;
  cancelText: string;
  confirmText: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel?: () => void;
};

export const showConfirmDialog = (input: ConfirmDialogOptions): void => {
  if (Platform.OS === "web") {
    const browserConfirm = (globalThis as { confirm?: (message?: string) => boolean }).confirm;
    if (typeof browserConfirm === "function") {
      const prompt = [input.title.trim(), input.message.trim()].filter(Boolean).join("\n\n");
      const approved = browserConfirm(prompt);
      if (approved) {
        input.onConfirm();
      } else {
        input.onCancel?.();
      }
      return;
    }
  }

  Alert.alert(input.title, input.message, [
    { text: input.cancelText, style: "cancel", onPress: input.onCancel },
    {
      text: input.confirmText,
      style: input.destructive ? "destructive" : "default",
      onPress: input.onConfirm,
    },
  ]);
};

