/** Shown instantly while a page's Firestore reads run on the server. */
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading">
      <div className="skel skel-title" />
      <div className="card"><div className="skel" /><div className="skel" /><div className="skel skel-short" /></div>
      <div className="card"><div className="skel" /><div className="skel" /><div className="skel" /><div className="skel skel-short" /></div>
    </div>
  );
}
