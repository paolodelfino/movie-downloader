#!/usr/bin/env node

import path from "path";
import fs from "fs";
import inquirer from "inquirer";
import chalk from "chalk";
import { sline } from "./utils.js";
import nanospinner, { createSpinner } from "nanospinner";
import * as sc_wrapper from "sc-wrapper";

// const basepath = process.argv[1].substring(
//   0,
//   process.argv[1].lastIndexOf("\\")
// );

header();
sline();

const name = await retrieve_query();

sline();
const entries = await search(name);

sline();
const { movie_name, movie_id, episode_id, season_number } = await choose(
  entries
);

sline();
const playlist = await retrieve_playlist(movie_id, episode_id);

sline();
const outputdir = await retrieve_outputdir();

await download(playlist, path.join(outputdir, `${movie_name}.mp4`));

function header() {
  console.log(
    `${chalk.bgRed(chalk.bold("  Movie Downloader  "))}${chalk.bgBlue(
      chalk.bold("  🐙  movie-downloader  ")
    )}`
  );
}

/**
 * @returns Promise<string>
 */
async function retrieve_query() {
  return (
    await inquirer.prompt({
      type: "input",
      name: "name",
      message: "Search for ",
      validate: (i) => {
        return Boolean(i.trim());
      },
    })
  ).name;
}

/**
 *
 * @param {string} name
 * @returns Promise<Movie[]>
 */
async function search(name) {
  const spinner = nanospinner.createSpinner();
  spinner.start();

  const found = await sc_wrapper.search_movie(name.trim(), {
    match_exact: true,
    match_estimate: true,
  });
  if (found.length == 0) {
    spinner.error({
      text: "No results",
    });
  }
  spinner.success({
    text: ` ${found.length} found`,
  });

  return found;
}

/**
 *
 * @param {Movie[]} entries
 * @returns {object} An object with properties:
 *   - movie_name {number}
 *   - movie_id {number}
 *   - episode_id {number} (optional)
 *   - season_number {number} (optional)
 */
async function choose(entries) {
  const ret = {};

  let choices = [];
  entries.forEach((v, i) =>
    choices.push({
      name: v.friendly_name,
      value: i.toString(),
    })
  );

  const { movie_index } = await inquirer.prompt({
    type: "list",
    name: "movie_index",
    message: "Choose one of below",
    choices,
  });

  const movie = entries[movie_index];
  ret.movie_name = movie.friendly_name;
  if (movie.is_series) {
    choices = [];
    movie.seasons.forEach((v, i) =>
      choices.push({
        name: v.number.toString(),
        value: i.toString(),
      })
    );

    const { season_index } = await inquirer.prompt({
      type: "list",
      name: "season_index",
      message: "Select a season",
      choices,
    });
    const season = movie.seasons[season_index];
    ret.season_number = season.number;

    choices = [];
    season.episodes.forEach((v, i) =>
      choices.push({
        name: v.number.toString(),
        value: i.toString(),
      })
    );

    const { episode_index } = await inquirer.prompt({
      type: "list",
      name: "episode_index",
      message: "Select an episode",
      choices,
    });
    const episode = season.episodes[episode_index];
    ret.episode_id = episode.id;
  }
  ret.movie_id = movie.id;

  return ret;
}

/**
 *
 * @param {number} movie_index
 * @param {number?} episode_index
 * @returns Promise<string>
 */
async function retrieve_playlist(movie_id, episode_id) {
  const spinner = nanospinner.createSpinner(" Retrieving watch playlist");
  spinner.start();

  const playlist = await sc_wrapper.get_playlist({
    movie_id,
    episode_id,
  });
  spinner.success();
  return playlist;
}

/**
 * @returns Promise<string>
 */
async function retrieve_outputdir() {
  return (
    await inquirer.prompt({
      type: "input",
      name: "outputdir",
      message: "Provide the output directory ",
      validate: (dir) => {
        try {
          fs.accessSync(dir, fs.constants.R_OK | fs.constants.W_OK);
          return true;
        } catch (err) {
          return false;
        }
      },
    })
  ).outputdir;
}

/**
 *
 * @param {string} playlist
 * @param {string} output
 */
async function download(playlist, output) {
  const spinner = createSpinner();
  spinner.start({
    text: "Downloading... this might take some minutes",
  });

  const buffer = await sc_wrapper.download(playlist, "buffer");
  spinner.stop();

  spinner.start({
    text: `Saving to file ${output}`,
  });

  fs.writeFileSync(output, buffer);
  spinner.stop();
}
