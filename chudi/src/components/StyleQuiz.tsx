import React from 'react';
import { getStyleQuizProfile, saveStyleQuizProfile, type StyleQuizProfile } from '../services/api';
import '../styles/StyleQuiz.css';

interface StyleQuizProps {
  onSaved?: () => void;
}

const categoryOptions = ['Anarkali', 'Casual', 'Chikankari', 'Formal', 'Short', 'Silk'];
const colorOptions = ['Blue', 'Green', 'Maroon', 'Peach', 'Pink', 'Teal', 'White', 'Yellow'];
const materialOptions = ['Cotton', 'Rayon', 'Georgette', 'Silk', 'Pure Silk'];
const occasionOptions = ['Office', 'Daily Wear', 'Festive', 'Party', 'Travel'];

export const StyleQuiz: React.FC<StyleQuizProps> = ({ onSaved }) => {
  const [profile, setProfile] = React.useState<StyleQuizProfile>({
    preferred_categories: [],
    preferred_colors: [],
    preferred_materials: [],
    budget_max: null,
    occasions: [],
  });
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [expanded, setExpanded] = React.useState(false);
  const [message, setMessage] = React.useState('');

  React.useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      try {
        const res = await getStyleQuizProfile();
        if (!mounted) return;
        if (res.exists && res.profile) {
          setProfile({
            preferred_categories: res.profile.preferred_categories ?? [],
            preferred_colors: res.profile.preferred_colors ?? [],
            preferred_materials: res.profile.preferred_materials ?? [],
            budget_max: res.profile.budget_max ?? null,
            occasions: res.profile.occasions ?? [],
            updated_at: res.profile.updated_at,
          });
        }
      } catch {
        // Keep defaults if profile read fails.
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, []);

  const toggleValue = (key: 'preferred_categories' | 'preferred_colors' | 'preferred_materials' | 'occasions', value: string) => {
    setProfile((previous) => {
      const values = previous[key] ?? [];
      const exists = values.includes(value);
      return {
        ...previous,
        [key]: exists ? values.filter((item) => item !== value) : [...values, value],
      };
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage('');
    try {
      await saveStyleQuizProfile({
        preferred_categories: profile.preferred_categories,
        preferred_colors: profile.preferred_colors,
        preferred_materials: profile.preferred_materials,
        budget_max: profile.budget_max ?? null,
        occasions: profile.occasions,
      });
      setMessage('Style preferences updated. Recommendations are now personalized.');
      onSaved?.();
    } catch {
      setMessage('Failed to save preferences. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="style-quiz">
      <div className="container">
        <div className="style-quiz-header">
          <div>
            <h2>AI Style Quiz</h2>
            <p>Set your preferences once and get smarter recommendations.</p>
          </div>
          <button type="button" className="style-quiz-toggle" onClick={() => setExpanded((prev) => !prev)}>
            {expanded ? 'Hide Quiz' : 'Open Quiz'}
          </button>
        </div>

        {expanded && (
          <div className="style-quiz-panel">
            <div className="style-quiz-group">
              <h3>Preferred Categories</h3>
              <div className="style-quiz-options">
                {categoryOptions.map((option) => (
                  <button
                    key={option}
                    type="button"
                    className={`style-option ${profile.preferred_categories.includes(option) ? 'active' : ''}`}
                    onClick={() => toggleValue('preferred_categories', option)}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>

            <div className="style-quiz-group">
              <h3>Preferred Colors</h3>
              <div className="style-quiz-options">
                {colorOptions.map((option) => (
                  <button
                    key={option}
                    type="button"
                    className={`style-option ${profile.preferred_colors.includes(option) ? 'active' : ''}`}
                    onClick={() => toggleValue('preferred_colors', option)}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>

            <div className="style-quiz-group">
              <h3>Preferred Fabrics</h3>
              <div className="style-quiz-options">
                {materialOptions.map((option) => (
                  <button
                    key={option}
                    type="button"
                    className={`style-option ${profile.preferred_materials.includes(option) ? 'active' : ''}`}
                    onClick={() => toggleValue('preferred_materials', option)}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>

            <div className="style-quiz-group">
              <h3>Occasions</h3>
              <div className="style-quiz-options">
                {occasionOptions.map((option) => (
                  <button
                    key={option}
                    type="button"
                    className={`style-option ${profile.occasions.includes(option) ? 'active' : ''}`}
                    onClick={() => toggleValue('occasions', option)}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>

            <div className="style-quiz-budget">
              <label htmlFor="style-budget">Max Budget (Rs)</label>
              <input
                id="style-budget"
                type="number"
                min={200}
                max={10000}
                value={profile.budget_max ?? ''}
                onChange={(event) => {
                  const raw = Number(event.target.value);
                  setProfile((prev) => ({
                    ...prev,
                    budget_max: Number.isFinite(raw) && raw > 0 ? raw : null,
                  }));
                }}
                placeholder="e.g. 1800"
              />
            </div>

            <div className="style-quiz-actions">
              <button type="button" className="style-save-btn" onClick={() => void handleSave()} disabled={saving || loading}>
                {saving ? 'Saving...' : 'Save Preferences'}
              </button>
              {message ? <p>{message}</p> : null}
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
