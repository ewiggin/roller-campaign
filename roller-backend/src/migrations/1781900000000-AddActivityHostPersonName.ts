import { MigrationInterface, QueryRunner } from 'typeorm';

// Food shifts used to store the host person's name only inside the generated
// description: "Estais invitados a comer en casa de {name} en {address}.
// Su tel. es {phone}.". This migration adds a dedicated column and backfills
// it by parsing that description on existing food shifts.
export class AddActivityHostPersonName1781900000000 implements MigrationInterface {
  async up(runner: QueryRunner): Promise<void> {
    await runner.query(
      `ALTER TABLE activities ADD COLUMN host_person_name varchar`,
    );

    const rows: { id: string; description: string }[] = await runner.query(
      `SELECT id, description FROM activities
       WHERE is_food_shift = true
         AND description LIKE 'Estais invitados a comer en casa de %'`,
    );

    for (const row of rows) {
      const name = this.extractHostPersonName(row.description);
      if (!name) continue;
      const escapedName = name.replace(/'/g, "''");
      const escapedId = String(row.id).replace(/'/g, "''");
      await runner.query(
        `UPDATE activities SET host_person_name = '${escapedName}' WHERE id = '${escapedId}'`,
      );
    }
  }

  async down(runner: QueryRunner): Promise<void> {
    await runner.query(`ALTER TABLE activities DROP COLUMN host_person_name`);
  }

  // Description format (see parseFoodShiftDescription in activities.service):
  //   "Estais invitados a comer[ en casa de {name}][ en {address}].[ Su tel. es {phone}.]"
  // The name is everything between "en casa de " and the address separator
  // " en " (or the closing period when there is no address).
  private extractHostPersonName(description: string): string | null {
    const prefix = 'Estais invitados a comer en casa de ';
    if (!description.startsWith(prefix)) return null;
    let rest = description.slice(prefix.length);
    rest = rest.replace(/ Su tel\. es [\s\S]*$/, '');
    const addressIdx = rest.indexOf(' en ');
    const name = (addressIdx >= 0 ? rest.slice(0, addressIdx) : rest)
      .replace(/\.\s*$/, '')
      .trim();
    return name || null;
  }
}
