export default function Toast({ toast }) {
  if (!toast) return null;
  return (
    <div className="toast-wrap" role="status" aria-live="polite">
      <div className={toast.kind === "error" ? "toast toast-error" : "toast"}>
        {toast.text}
      </div>
    </div>
  );
}
