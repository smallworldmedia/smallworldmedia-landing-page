import InfoPill from '../components/InfoPill';

export default function Nav({ isOpen, onToggle }) {
    return (
        <header className="nav" data-open={isOpen}>
            <InfoPill isOpen={isOpen} onToggle={onToggle} />
        </header>
    );
}
