"use client";

import { useGenerationParams } from "@/hooks/useGenerationParams";
import { getSupportedLocales } from "@/lib/locales";
import { FaThumbsUp } from "react-icons/fa";

const LOCALES = getSupportedLocales();

export function Toolbar() {
  const { locale, seed, likesAvg, setParams } = useGenerationParams();

  function randomizeSeed() {
    // Generate a random seed as a BigInt-safe string
    const high = Math.floor(Math.random() * 0xFFFFFFFF);
    const low  = Math.floor(Math.random() * 0xFFFFFFFF);
    const randomSeed = (BigInt(high) * 0x100000000n + BigInt(low)).toString();
    setParams({ seed: randomSeed });
  }

  return (
    <div className="flex flex-wrap fixed w-full items-center gap-4 border-b border-green-600 bg-black px-6 py-3">

      {/* Locale selector */}
      <div className="flex items-center gap-2">
        <label htmlFor="locale" className="text-sm font-semibold text-white">
          Language
        </label>
        <select
          id="locale"
          value={locale}
          onChange={(e) => setParams({ locale: e.target.value })}
          className="rounded-xl border border-zinc-300 bg-white px-2 py-1 text-sm text-zinc-800 focus:outline-none focus:ring-2 focus:ring-black"
        >
          {LOCALES.map((l) => (
            <option key={l.code} value={l.code}>
              {l.displayName}
            </option>
          ))}
        </select>
      </div>

      {/* Seed input + randomize */}
      <div className="flex items-center gap-2">
        <label htmlFor="seed" className="text-sm font-semibold text-white">
          Seed
        </label>
        <input
          id="seed"
          type="text"
          value={seed}
          onChange={(e) => {
            // Only allow digit strings — reject anything that would break BigInt()
            if (/^\d*$/.test(e.target.value)) {
              setParams({ seed: e.target.value || "0" });
            }
          }}
          className="w-44 rounded-xl border bg-white px-2 py-1 text-sm text-black focus:outline-none focus:ring-2 focus:ring-black"
          placeholder="Enter seed..."
        />
        <button id="shuffleBtn" className="icon-button" onClick={randomizeSeed}>
          <svg xmlns="http://w3.org" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M2 18h1.4c1.3 0 2.5-.6 3.3-1.7l6.1-8.6c.7-1.1 2-1.7 3.3-1.7H22"/>
            <path d="m18 2 4 4-4 4"/>
            <path d="M2 6h1.9c1.2 0 2.3.6 3 1.7l1.1 1.6"/>
            <path d="m15.4 12.8 1.2 1.7c.8 1.1 2 1.7 3.2 1.7H22"/>
            <path d="m18 14 4 4-4 4"/>
          </svg>
        </button>
      </div>

      {/* Likes per song */}
      <div className="flex items-center gap-2 ml-6">
        
  <FaThumbsUp className="text-green-500 text-xl mb-1.5" />


        <label htmlFor="likes" className="text-md font-semibold text-green-500">
          Likes
        </label>
        <input
          id="likes"
          type="range"
          min={0}
          max={10}
          step={0.1}
          value={likesAvg}
          onChange={(e) => setParams({ likesAvg: parseFloat(e.target.value) })}
          className="w-32 accent-green-100"
        />
        <span className="w-8 text-sm tabular-nums text-green-500">
          {likesAvg.toFixed(1)}
        </span>
      </div>

    </div>
  );
}