import React from "react";

/**
 * Top-level error boundary. Catches render/lifecycle errors anywhere in the tree
 * and shows a recoverable fallback instead of a blank white screen. Copy is kept
 * language-neutral (all three UI languages) because i18n context may itself be
 * part of the broken subtree.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    // Surface for logging/observability; avoid throwing from the handler itself.
    // eslint-disable-next-line no-console
    console.error("Uncaught UI error:", error, info);
  }

  handleReload = () => {
    this.setState({ hasError: false });
    window.location.assign("/");
  };

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="error-boundary" role="alert">
        <div className="error-boundary__card">
          <h1>Xatolik / Ошибка / Something went wrong</h1>
          <p>
            Sahifani qayta yuklang · Перезагрузите страницу · Please reload the
            page.
          </p>
          <button type="button" onClick={this.handleReload}>
            Bosh sahifa · На главную · Home
          </button>
        </div>
      </div>
    );
  }
}
