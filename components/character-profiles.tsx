import { Users } from "lucide-react";
import { Art } from "@/components/art";
import type { Character } from "@/lib/types";

export function CharacterProfiles({ profiles, showSeries = false }: { profiles: Character[]; showSeries?: boolean }) {
  return <div className="profile-grid">
    {profiles.map((profile, index) => <article className="admin-panel character-profile" key={`${profile.name}/${index}`}>
      {profile.image_id ? <Art id={profile.image_id} alt={`Portrait of ${profile.name}`} className="character-portrait" />
        : <span className="section-icon"><Users size={20} aria-hidden="true" /></span>}
      <h3>{profile.name}</h3>
      {showSeries && profile.series && <strong>{profile.series}</strong>}
      {profile.bio && <p>{profile.bio}</p>}
    </article>)}
  </div>;
}
