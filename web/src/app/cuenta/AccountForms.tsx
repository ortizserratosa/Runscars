"use client";

import { useActionState } from "react";
import {
  deleteAccountAction,
  type CommunityFormState,
  updateProfileAction,
} from "../comunidad/actions";

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
}: {
  profile: {
    display_name: string;
    slug: string;
    is_public: boolean;
    watched_is_public: boolean;
  };
}) {
  const [state, action, pending] = useActionState(
    updateProfileAction,
    initialCommunityFormState,
  );
  return (
    <form action={action} className="account-form">
      <label htmlFor="display-name">Nombre visible</label>
      <input
        defaultValue={profile.display_name}
        id="display-name"
        maxLength={60}
        minLength={2}
        name="displayName"
        required
      />
      <label htmlFor="profile-slug">Dirección pública</label>
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
        Perfil público
      </label>
      <label className="check-row">
        <input
          defaultChecked={profile.watched_is_public}
          name="watchedIsPublic"
          type="checkbox"
        />
        Mostrar también mis películas vistas
      </label>
      <button className="primary-button dark-button" disabled={pending}>
        {pending ? "Guardando…" : "Guardar perfil"}
      </button>
      <Message message={state.message} tone={state.tone} />
    </form>
  );
}

export function DeleteAccountForm() {
  const [state, action, pending] = useActionState(
    deleteAccountAction,
    initialCommunityFormState,
  );
  return (
    <form action={action} className="account-form danger-form">
      <label htmlFor="delete-confirmation">
        Escribe <strong>ELIMINAR</strong>
      </label>
      <input
        autoComplete="off"
        id="delete-confirmation"
        name="confirmation"
        required
      />
      <label htmlFor="delete-password">Contraseña actual</label>
      <input
        autoComplete="current-password"
        id="delete-password"
        minLength={8}
        name="password"
        required
        type="password"
      />
      <button className="danger-button" disabled={pending}>
        {pending ? "Eliminando…" : "Eliminar cuenta y contenido"}
      </button>
      <Message message={state.message} tone={state.tone} />
    </form>
  );
}
