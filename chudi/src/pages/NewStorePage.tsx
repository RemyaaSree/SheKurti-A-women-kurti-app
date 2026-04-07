import React from 'react';
import { useNavigate } from 'react-router-dom';
import { NewStoreSection } from '../components/NewStoreSection';

export const NewStorePage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div style={{ padding: '32px 0 60px', background: 'var(--bg-white)' }}>
      <NewStoreSection
        onExploreBottomWear={() => navigate('/bottomwear')}
        onExploreDupatta={() => navigate('/dupatta')}
      />
    </div>
  );
};
