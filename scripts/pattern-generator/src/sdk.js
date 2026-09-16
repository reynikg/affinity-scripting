// The one place this project touches Affinity's own modules.
//
// Affinity resolves `require('/document.js')` against its built-in SDK, but the
// bundler would try to read those paths off disk. Going through `req` — an
// alias the bundler does not recognise as a require call — leaves them alone,
// so they stay live `require`s in the script Affinity finally runs.
const req = require;

export const { app } = req("/application.js");
export const { Document } = req("/document.js");
export const { Dialog, DialogResult } = req("/dialog.js");
export const { Colour } = req("/colours.js");
export const { FillDescriptor } = req("/fills.js");
export const { LineStyleDescriptor } = req("/linestyle.js");
export const { CurveBuilder, PolyCurve, Transform } = req("/geometry.js");
export const { ContainerNodeDefinition, PolyCurveNodeDefinition } = req("/nodes.js");
export const { AddChildNodesCommandBuilder, CompoundCommandBuilder } = req("/commands.js");
export const { UnitType } = req("/units.js");
export const { BlendMode } = req("affinity:common");
