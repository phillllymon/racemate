import { useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "./AuthContext";
import { useDataSync } from "./useDataSync";
import {
  createClub, getAllClubs, getMyClubs, getClubMembers, joinClub, leaveClub,
} from "./api";
import type { ClubRecord, ClubMember } from "./api";

interface ClubsModalProps {
  open: boolean;
  onClose: () => void;
}

export default function ClubsModal({ open, onClose }: ClubsModalProps) {
  const { user, token } = useAuth();
  const auth = user && token ? { userId: user.id, token } : null;

  const [myClubs, setMyClubs] = useState<ClubRecord[]>([]);
  const [allClubs, setAllClubs] = useState<ClubRecord[]>([]);
  const [loading, setLoading] = useState(false);

  // Create club
  const [creating, setCreating] = useState(false);
  const [newClubName, setNewClubName] = useState("");
  const [createBusy, setCreateBusy] = useState(false);

  // View members
  const [viewingClubId, setViewingClubId] = useState<number | null>(null);
  const [members, setMembers] = useState<ClubMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!auth) return;
    setLoading(true);
    try {
      const [myRes, allRes] = await Promise.all([
        getMyClubs(auth),
        getAllClubs(auth),
      ]);
      setMyClubs(myRes.clubs || []);
      setAllClubs(allRes.clubs || []);
    } catch {
      // Keep existing state
    }
    setLoading(false);
  }, [auth?.userId, auth?.token]);

  useDataSync(refresh, [auth?.userId], open && !!auth);

  const handleCreate = async () => {
    if (!auth || !newClubName.trim()) return;
    setCreateBusy(true);
    try {
      await createClub(auth, newClubName.trim());
      setNewClubName("");
      setCreating(false);
      await refresh();
    } catch {
      // ignore
    }
    setCreateBusy(false);
  };

  const handleJoin = async (clubId: number) => {
    if (!auth) return;
    try {
      await joinClub(auth, clubId);
      await refresh();
    } catch {
      // ignore
    }
  };

  const handleLeave = async (clubId: number) => {
    if (!auth) return;
    try {
      const res = await leaveClub(auth, clubId);
      if (res.message === "left club") {
        setViewingClubId(null);
        await refresh();
      } else {
        alert(res.message);
      }
    } catch {
      // ignore
    }
  };

  const viewMembers = async (clubId: number) => {
    if (!auth) return;
    if (viewingClubId === clubId) {
      setViewingClubId(null);
      return;
    }
    setViewingClubId(clubId);
    setMembersLoading(true);
    try {
      const res = await getClubMembers(auth, clubId);
      setMembers(res.members || []);
    } catch {
      setMembers([]);
    }
    setMembersLoading(false);
  };

  const myClubIds = new Set(myClubs.map((c) => c.id));
  const browsableClubs = allClubs.filter((c) => !myClubIds.has(c.id));

  if (!open) return null;

  return createPortal(
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <span className="settings-title">Clubs</span>
          <button className="settings-close" onClick={onClose}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="settings-body">
          {loading && myClubs.length === 0 && (
            <div className="clubs-loading">Loading clubs...</div>
          )}

          {/* My Clubs */}
          <div className="settings-section">
            <div className="settings-section-label">My Clubs</div>
            {myClubs.length === 0 && !loading && (
              <div className="clubs-empty">You haven't joined any clubs yet.</div>
            )}
            {myClubs.map((club) => (
              <div key={club.id} className="club-card">
                <button className="club-card-header" onClick={() => viewMembers(club.id)}>
                  <div className="club-card-info">
                    <span className="club-card-name">{club.name}</span>
                    <span className="club-card-role">{club.member_role}</span>
                  </div>
                  <span className={`race-card-chevron ${viewingClubId === club.id ? "race-card-chevron--open" : ""}`}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="9 6 15 12 9 18" />
                    </svg>
                  </span>
                </button>

                {viewingClubId === club.id && (
                  <div className="club-card-body">
                    {membersLoading ? (
                      <div className="clubs-loading">Loading members...</div>
                    ) : (
                      <>
                        <div className="club-members-label">{members.length} member{members.length !== 1 ? "s" : ""}</div>
                        {members.map((m) => (
                          <div key={m.id} className="club-member-row">
                            <span className="club-member-name">
                              {m.user_name || "Unknown"}
                              {m.user_id === user?.id && <span className="club-member-you"> (you)</span>}
                            </span>
                            <span className="club-member-role">{m.role}</span>
                          </div>
                        ))}
                        <button
                          className="btn-text-danger"
                          onClick={() => handleLeave(club.id)}
                        >
                          Leave club
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Create Club */}
          <div className="settings-section">
            {creating ? (
              <div className="club-create-form">
                <input
                  className="login-input"
                  placeholder="Club name"
                  value={newClubName}
                  onChange={(e) => setNewClubName(e.target.value)}
                  autoFocus
                />
                <div className="club-create-actions">
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={handleCreate}
                    disabled={createBusy || !newClubName.trim()}
                  >
                    {createBusy ? "..." : "Create"}
                  </button>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => { setCreating(false); setNewClubName(""); }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button className="btn btn-secondary" onClick={() => setCreating(true)}>
                + Create Club
              </button>
            )}
          </div>

          {/* Browse Clubs */}
          {browsableClubs.length > 0 && (
            <div className="settings-section">
              <div className="settings-section-label">Browse Clubs</div>
              {browsableClubs.map((club) => (
                <div key={club.id} className="club-browse-row">
                  <span className="club-browse-name">{club.name}</span>
                  <button
                    className="btn btn-primary btn-sm club-join-btn"
                    onClick={() => handleJoin(club.id)}
                  >
                    Join
                  </button>
                </div>
              ))}
            </div>
          )}

          {!loading && allClubs.length === 0 && (
            <div className="clubs-empty">No clubs exist yet. Create one to get started!</div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
