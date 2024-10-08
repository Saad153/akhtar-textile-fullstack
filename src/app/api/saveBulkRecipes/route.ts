// import { NextRequest, NextResponse } from 'next/server';
// import { Client } from 'pg';

// // Initialize the PostgreSQL client
// const client = new Client({
//   connectionString: process.env.NEXT_PUBLIC_DATABASE_URL,
// });

// client.connect();

// // Handler for POST requests
// export async function POST(request: NextRequest) {
//   try {
//     // Parse the JSON body
//     const fullData = await request.json();
//     console.log(fullData);

//     // Check if fullData is an array (multiple recipes) or a single object (one recipe)
//     const recipes = Array.isArray(fullData) ? fullData : [fullData];

//     // Iterate through each recipe (even if it's just one)
//     for (const recipe of recipes) {
//       // Save recipe details to the 'recipes' table
//       const result = await client.query(
//         `INSERT INTO recipes (Load_Size, Machine_Type, Finish, Fabric, Recipe, Fno, name)
//          VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
//         [
//           recipe.load_size,
//           recipe.machine_type,
//           recipe.finish,
//           recipe.fabric,
//           recipe.recipe_no,
//           recipe.Fno,
//           recipe.file_name,

//         ]
//       );

//       const recipeId = result.rows[0].id;

//       // Loop through the steps within each recipe
//       for (const step of recipe.step) {
//         // Save each step to the 'steps' table
//         const stepResult = await client.query(
//           `INSERT INTO steps (step_no, action, minutes, liters, RPM, centigrade, PH, TDS, TSS, recipesid)
//            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
//           [
//             step.step_no,
//             step.action,
//             step.minutes,
//             step.litres,
//             step.rpm,
//             step.temperature,
//             step.PH,
//             step.TDS,
//             step.TSS,
//             recipeId,
//           ]
//         );

//         const stepId = stepResult.rows[0].id;

//         // If the step contains chemicals, save them to 'chemicals' and 'chemical_association'
//         if (step.chemicals && step.chemicals.length > 0) {
//           for (const chemical of step.chemicals) {
//             // Insert chemical details to 'chemicals' table and get the chemical ID
//             const chemicalResult = await client.query(
//               `INSERT INTO chemicals (name)
//                VALUES ($1) RETURNING id`,
//               [chemical.recipe_name]
//             );

//             const chemicalId = chemicalResult.rows[0].id;

//             // Associate the chemical with the step in 'chemical_association' table
//             await client.query(
//               `INSERT INTO chemical_association (stepid, chemicalid, percentage, dosage)
//                VALUES ($1, $2, $3, $4)`,
//               [stepId, chemicalId, chemical.percentage, chemical.dosage]
//             );
//           }
//         }
//       }
//     }

//     return NextResponse.json({ success: true });

//   } catch (error) {
//     console.error('Error saving recipe data:', error);
//     return NextResponse.json({ success: false, message: 'Failed to save recipe data' }, { status: 500 });
//   }
// }


import { NextRequest, NextResponse } from 'next/server';
import { Client } from 'pg';

// Initialize the PostgreSQL client
const client = new Client({
  connectionString: process.env.NEXT_PUBLIC_DATABASE_URL,
});

client.connect();

// Handler for POST requests
export async function POST(request: NextRequest) {
  const client = new Client({
    connectionString: process.env.NEXT_PUBLIC_DATABASE_URL,
  });

  await client.connect();

  try {
    // Parse the JSON body
    const fullData = await request.json();
    console.log(fullData);

    // Check if fullData is an array (multiple recipes) or a single object (one recipe)
    const recipes = Array.isArray(fullData) ? fullData : [fullData];

    // Start a transaction
    await client.query('BEGIN');

    for (const recipe of recipes) {
      // Save recipe details to the 'recipes' table
      const result = await client.query(
        `INSERT INTO recipes (Load_Size, Machine_Type, Finish, Fabric, Recipe, Fno, name)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
        [
          recipe.load_size,
          recipe.machine_type,
          recipe.finish,
          recipe.fabric,
          recipe.recipe_no,
          recipe.Fno,
          recipe.file_name,
        ]
      );

      const recipeId = result.rows[0].id;

      // Collect promises for steps to insert them concurrently
      const stepPromises = recipe.step.map(async (step:any) => {
        // Save each step to the 'steps' table
        const stepResult = await client.query(
          `INSERT INTO steps (step_no, action, minutes, liters, RPM, centigrade, PH, TDS, TSS, recipesid)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
          [
            step.step_no,
            step.action,
            step.minutes,
            step.litres,
            step.rpm,
            step.temperature,
            step.PH,
            step.TDS,
            step.TSS,
            recipeId,
          ]
        );

        const stepId = stepResult.rows[0].id;

        // If the step contains chemicals, save them to 'chemicals' and 'chemical_association'
        if (step.chemicals && step.chemicals.length > 0) {
          const chemicalPromises = step.chemicals.map(async (chemical:any) => {
            // Insert chemical details to 'chemicals' table and get the chemical ID
            const chemicalResult = await client.query(
              `INSERT INTO chemicals (name)
               VALUES ($1) RETURNING id`,
              [chemical.recipe_name]
            );

            const chemicalId = chemicalResult.rows[0].id;

            // Associate the chemical with the step in 'chemical_association' table
            await client.query(
              `INSERT INTO chemical_association (stepid, chemicalid, percentage, dosage)
               VALUES ($1, $2, $3, $4)`,
              [stepId, chemicalId, chemical.percentage, chemical.dosage]
            );
          });
          await Promise.all(chemicalPromises);
        }
      });

      await Promise.all(stepPromises);
    }

    // Commit the transaction
    await client.query('COMMIT');

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Error saving recipe data:', error);
    await client.query('ROLLBACK'); // Rollback in case of error
    return NextResponse.json({ success: false, message: 'Failed to save recipe data' }, { status: 500 });
  } finally {
    await client.end(); // Close the client connection
  }
}
