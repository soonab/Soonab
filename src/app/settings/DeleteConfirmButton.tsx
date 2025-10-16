'use client';

export default function DeleteConfirmButton() {
  return (
    <button
      className="rounded border px-3 py-1"
      onClick={(e) => {
        const ok = confirm('Soft-delete your profile?');
        if (!ok) {
          e.preventDefault();
          return;
        }
        // Submit the enclosing form
        const form = (e.currentTarget as HTMLButtonElement).closest('form');
        if (form) form.submit();
      }}
      type="button"
    >
      Delete my profile
    </button>
  );
}
