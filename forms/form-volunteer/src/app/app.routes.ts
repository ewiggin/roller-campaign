import { Routes } from "@angular/router";

export const routes: Routes = [
  {
    path: "",
    loadComponent: () =>
      import("./components/volunteer-form/volunteer-form.component").then(
        (m) => m.VolunteerFormComponent,
      ),
  },
  {
    path: "legal",
    loadComponent: () =>
      import("./pages/legal/legal").then((m) => m.LegalComponent),
  },
  { path: "**", redirectTo: "" },
];
