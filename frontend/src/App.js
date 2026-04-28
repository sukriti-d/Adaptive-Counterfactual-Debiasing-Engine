import React, { useState, useCallback } from "react";
import Dashboard from "./components/Dashboard";
import UploadScreen from "./components/UploadScreen";

const API = "https://your-backend-name.onrender.com";

export default function App() {
  const [result, setResult] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [source, setSource] = useState(null);

  const runDemo = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/demo`);
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setResult(data);
      setSessionId(data.session_id);
      setSource("demo");
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [API]);

  const runUpload = useCallback(async (file) => {
    setLoading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const up = await fetch(`${API}/upload`, { method: "POST", body: form });
      if (!up.ok) throw new Error(await up.text());
      const meta = await up.json();

      const an = await fetch(`${API}/analyze/${meta.session_id}`, { method: "POST" });
      if (!an.ok) throw new Error(await an.text());
      const data = await an.json();
      setResult(data);
      setSessionId(meta.session_id);
      setSource("upload");
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setResult(null);
    setSessionId(null);
    setError(null);
    setSource(null);
  }, []);

  if (result) {
    return <Dashboard data={result} sessionId={sessionId} onReset={reset} source={source} />;
  }

  return (
    <UploadScreen
      onDemo={runDemo}
      onUpload={runUpload}
      loading={loading}
      error={error}
    />
  );
}
