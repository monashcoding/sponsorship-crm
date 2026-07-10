import { type ReactNode, useEffect } from "react";

export function Modal({
	title,
	onClose,
	children,
}: {
	title: string;
	onClose: () => void;
	children: ReactNode;
}) {
	// Close on Escape — the accessible keyboard path (backdrop divs aren't focusable).
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") onClose();
		};
		document.addEventListener("keydown", onKey);
		return () => document.removeEventListener("keydown", onKey);
	}, [onClose]);

	return (
		// Backdrop click-to-close: only when the click lands on the backdrop itself,
		// so clicks inside the dialog don't bubble up and close it.
		// biome-ignore lint/a11y/noStaticElementInteractions: overlay close affordance; accessible close is the ✕ button and Escape (handled above)
		// biome-ignore lint/a11y/useKeyWithClickEvents: keyboard close is Escape, handled at document level in useEffect
		<div
			className="modal-backdrop"
			onClick={(e) => {
				if (e.target === e.currentTarget) onClose();
			}}
		>
			<div className="modal" role="dialog" aria-modal="true">
				<div className="modal-head">
					<h2>{title}</h2>
					<button
						type="button"
						className="btn btn-ghost"
						onClick={onClose}
						aria-label="Close"
					>
						✕
					</button>
				</div>
				{children}
			</div>
		</div>
	);
}
