"use client";

import { useActionState } from "react";
import {
  deleteAccountAction,
  type CommunityFormState,
  updateProfileAction,
} from "../comunidad/actions";
import type { Locale } from "../../lib/i18n/config";

const initialCommunityFormState: CommunityFormState = {
  message: "",
  tone: "idle",
};

function Message({
  message,
  tone,
}: {
  message: string;
  tone: "error" | "success" | "idle";
}) {
  return (
    <p aria-live="polite" className={`form-message ${tone}`}>
      {message}
    </p>
  );
}

export function ProfileForm({
  profile,
  locale,
}: {
  profile: {
    display_name: string;
    slug: string;
    is_public: boolean;
  };
  locale: Locale;
}) {
  const en = locale === "en";
  const [state, action, pending] = useActionState(
    updateProfileAction,
    initialCommunityFormState,
  );
  return (
    <form action={action} className="account-form">
      <input name="locale" type="hidden" value={locale} />
      <label htmlFor="display-name">
        {en ? "Display name" : "Nombre visible"}
      </label>
      <input
        defaultValue={profile.display_name}
        id="display-name"
        maxLength={60}
        minLength={2}
        name="displayName"
        required
      />
      <label htmlFor="profile-slug">
        {en ? "Public address" : "Dirección pública"}
      </label>
      <div className="slug-field">
        <span>/usuarios/</span>
        <input
          defaultValue={profile.slug}
          id="profile-slug"
          maxLength={48}
          minLength={3}
          name="slug"
          pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
          required
        />
      </div>
      <label className="check-row">
        <input
          defaultChecked={profile.is_public}
          name="isPublic"
          type="checkbox"
        />
        {en ? "Public profile" : "Perfil público"}
      </label>
      <button className="primary-button dark-button" disabled={pending}>
        {pending
          ? en
            ? "Saving…"
            : "Guardando…"
          : en
            ? "Save profile"
            : "Guardar perfil"}
      </button>
      <Message message={state.message} tone={state.tone} />
    </form>
  );
}

export function DeleteAccountForm({ locale }: { locale: Locale }) {
  const en = locale === "en";
  const [state, action, pending] = useActionState(
    deleteAccountAction,
    initialCommunityFormState,
  );
  return (
    <form action={action} className="account-form danger-form">
      <input name="locale" type="hidden" value={locale} />
      <label htmlFor="delete-confirmation">
        {en ? "Type" : "Escribe"} <strong>ELIMINAR</strong>
      </label>
      <input
        autoComplete="off"
        id="delete-confirmation"
        name="confirmation"
        required
      />
      <label htmlFor="delete-password">
        {en ? "Current password" : "Contraseña actual"}
      </label>
      <input
        autoComplete="current-password"
        id="delete-password"
        minLength={8}
        name="password"
        required
        type="password"
      />
      <button className="danger-button" disabled={pending}>
        {pending
          ? en
            ? "Deleting…"
            : "Eliminando…"
          : en
            ? "Delete account and content"
            : "Eliminar cuenta y contenido"}
      </button>
      <Message message={state.message} tone={state.tone} />
    </form>
  );
}
