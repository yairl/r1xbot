(async () => {
  try {
    require("dotenv").config();
    const sequelizeCommand = process.argv[2] || "db:migrate";
    const { exec } = require("child_process");

    console.log("Running DB migrations...");
    await Promise.all([
      new Promise((resolve, reject) => {
        const migrate = exec(
          `./node_modules/.bin/sequelize ${sequelizeCommand}`,
          { env: process.env },
          (err, stdout, stderr) => {
            if (err) {
              console.log("Error in postgres migration", err);
              return reject(err);
            }

            console.log("Finished running postgres migrations");
            resolve();
          }
        );

        // Listen for the console.log message and kill the process to proceed to the next step in the npm script
        migrate.stdout.on("data", (data) => {
          if (
            data.indexOf(
              "No migrations were executed, database schema was already up to date."
            ) !== -1
          ) {
            migrate.emit("SIGINT");
          }
        });
      }),
    ]);
  } catch (err) {
    process.exit(err.code);
  }
})();
