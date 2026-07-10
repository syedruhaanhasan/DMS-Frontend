import { useEffect, useState } from "react";

/** True after client mount so localStorage session/token can be read before API calls. */
export function useAuthReady(): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 0);
    return () => clearTimeout(t);
  }, []);
  return ready;
}
