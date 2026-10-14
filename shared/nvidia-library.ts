// Transcribed from the user-supplied NVIDIA Control Panel screenshots.
// Reference values are intentionally separate from detected Windows inventory.
export interface NvidiaSetting { id: string; category: string; title: string; value: string; tradeoff: string; route: string; perGame: boolean; }
export const NVIDIA_SETTINGS: NvidiaSetting[] = [
  {
    "id": "nvidia-1",
    "category": "3D",
    "title": "Image Scaling",
    "value": "Off",
    "tradeoff": "Driver upscaling can reduce render cost but changes image quality. Check in-game upscaling first.",
    "route": "Manage 3D settings",
    "perGame": true
  },
  {
    "id": "nvidia-2",
    "category": "3D",
    "title": "Ambient Occlusion",
    "value": "Off",
    "tradeoff": "Driver ambient occlusion applies only to compatible games; disabling it can remove extra shading.",
    "route": "Manage 3D settings",
    "perGame": true
  },
  {
    "id": "nvidia-3",
    "category": "3D",
    "title": "Anisotropic Filtering",
    "value": "Application-controlled",
    "tradeoff": "Use the game setting to balance texture clarity and GPU cost.",
    "route": "Manage 3D settings",
    "perGame": true
  },
  {
    "id": "nvidia-4",
    "category": "3D",
    "title": "Antialiasing – FXAA",
    "value": "Off",
    "tradeoff": "FXAA can soften edges and the whole image. Some games already provide their own antialiasing.",
    "route": "Manage 3D settings",
    "perGame": true
  },
  {
    "id": "nvidia-5",
    "category": "3D",
    "title": "Antialiasing – Gamma Correction",
    "value": "On",
    "tradeoff": "Changes supported antialiasing output; it is not a general FPS optimization.",
    "route": "Manage 3D settings",
    "perGame": true
  },
  {
    "id": "nvidia-6",
    "category": "3D",
    "title": "Antialiasing – Mode",
    "value": "Application-controlled",
    "tradeoff": "Let each game select compatible antialiasing instead of forcing a driver override.",
    "route": "Manage 3D settings",
    "perGame": true
  },
  {
    "id": "nvidia-7",
    "category": "3D",
    "title": "Antialiasing – Setting",
    "value": "Application-controlled",
    "tradeoff": "Inherited and disabled in the reference because the mode is application-controlled.",
    "route": "Manage 3D settings",
    "perGame": true
  },
  {
    "id": "nvidia-8",
    "category": "3D",
    "title": "Antialiasing – Transparency",
    "value": "Off",
    "tradeoff": "Transparency antialiasing can improve foliage but add GPU cost in supported rendering paths.",
    "route": "Manage 3D settings",
    "perGame": true
  },
  {
    "id": "nvidia-9",
    "category": "3D",
    "title": "Background Application Max Frame Rate",
    "value": "Off",
    "tradeoff": "A background cap can reduce power and heat while a game is unfocused; Off leaves it uncapped.",
    "route": "Manage 3D settings",
    "perGame": true
  },
  {
    "id": "nvidia-10",
    "category": "3D",
    "title": "CUDA – GPUs",
    "value": "All",
    "tradeoff": "Selects GPUs available to CUDA applications. It is not a gaming FPS switch.",
    "route": "Manage 3D settings",
    "perGame": true
  },
  {
    "id": "nvidia-11",
    "category": "3D",
    "title": "CUDA – Sysmem Fallback Policy",
    "value": "Prefer No Sysmem Fallback",
    "tradeoff": "Avoiding system-memory fallback can cause CUDA workloads to fail when VRAM is exhausted. Keep the default unless your workload requires this.",
    "route": "Manage 3D settings",
    "perGame": true
  },
  {
    "id": "nvidia-12",
    "category": "3D",
    "title": "DSR – Factors",
    "value": "Off",
    "tradeoff": "Rendering above native resolution increases GPU load. Available modes depend on hardware and driver.",
    "route": "Manage 3D settings",
    "perGame": true
  },
  {
    "id": "nvidia-13",
    "category": "3D",
    "title": "DSR – Smoothness",
    "value": "Off (inactive)",
    "tradeoff": "The reference control is inactive with DSR disabled; this is not an independently active value.",
    "route": "Manage 3D settings",
    "perGame": true
  },
  {
    "id": "nvidia-14",
    "category": "3D",
    "title": "Low Latency Mode",
    "value": "Off",
    "tradeoff": "For supported games prefer their NVIDIA Reflex control. Driver behavior depends on the graphics API; compare frame pacing and responsiveness.",
    "route": "Manage 3D settings",
    "perGame": true
  },
  {
    "id": "nvidia-15",
    "category": "3D",
    "title": "Max Frame Rate",
    "value": "Off",
    "tradeoff": "A suitable per-game cap can reduce heat and stabilize pacing. Off does not guarantee the lowest latency.",
    "route": "Manage 3D settings",
    "perGame": true
  },
  {
    "id": "nvidia-16",
    "category": "3D",
    "title": "Monitor Technology",
    "value": "G-SYNC Compatible",
    "tradeoff": "Requires a compatible connected display and enabled VRR. The screenshot value does not prove support on another monitor.",
    "route": "Manage 3D settings",
    "perGame": true
  },
  {
    "id": "nvidia-17",
    "category": "3D",
    "title": "Multi-Frame Sampled AA (MFAA)",
    "value": "Off",
    "tradeoff": "MFAA affects supported MSAA games only; compare image quality and compatibility.",
    "route": "Manage 3D settings",
    "perGame": true
  },
  {
    "id": "nvidia-18",
    "category": "3D",
    "title": "OpenGL GDI compatibility",
    "value": "Auto",
    "tradeoff": "Use the driver default unless an OpenGL application has a documented compatibility issue.",
    "route": "Manage 3D settings",
    "perGame": true
  },
  {
    "id": "nvidia-19",
    "category": "3D",
    "title": "OpenGL rendering GPU",
    "value": "Auto-select",
    "tradeoff": "On multi-GPU systems choose the adapter appropriate to the application; automatic selection is usually suitable.",
    "route": "Manage 3D settings",
    "perGame": true
  },
  {
    "id": "nvidia-20",
    "category": "3D",
    "title": "Power Management Mode",
    "value": "Prefer Maximum Performance",
    "tradeoff": "May hold higher clocks and increase heat, fan noise and idle power. Prefer testing this per game rather than globally.",
    "route": "Manage 3D settings",
    "perGame": true
  },
  {
    "id": "nvidia-21",
    "category": "3D",
    "title": "Preferred Refresh Rate",
    "value": "Highest Available",
    "tradeoff": "Applies to compatible display modes. Check the actual active refresh rate in Windows and the game.",
    "route": "Manage 3D settings",
    "perGame": true
  },
  {
    "id": "nvidia-22",
    "category": "3D",
    "title": "Shader Cache Size",
    "value": "100 GB",
    "tradeoff": "This is a cache limit, not a reserved allocation or an FPS guarantee. Consider free space; cached shaders may reduce repeat compilation.",
    "route": "Manage 3D settings",
    "perGame": true
  },
  {
    "id": "nvidia-23",
    "category": "3D",
    "title": "Texture Filtering – Anisotropic Sample Optimization",
    "value": "On",
    "tradeoff": "Can reduce texture-filtering work at the cost of image quality in supported applications.",
    "route": "Manage 3D settings",
    "perGame": true
  },
  {
    "id": "nvidia-24",
    "category": "3D",
    "title": "Texture Filtering – Negative LOD Bias",
    "value": "Clamp",
    "tradeoff": "May reduce texture shimmer where supported; driver and rendering API behavior varies.",
    "route": "Manage 3D settings",
    "perGame": true
  },
  {
    "id": "nvidia-25",
    "category": "3D",
    "title": "Texture Filtering – Quality",
    "value": "High Performance",
    "tradeoff": "Trades filtering quality for possible GPU savings. Compare the image and measured performance per game.",
    "route": "Manage 3D settings",
    "perGame": true
  },
  {
    "id": "nvidia-26",
    "category": "3D",
    "title": "Texture Filtering – Trilinear Optimization",
    "value": "On",
    "tradeoff": "Can reduce filtering work with an image-quality tradeoff in supported applications.",
    "route": "Manage 3D settings",
    "perGame": true
  },
  {
    "id": "nvidia-27",
    "category": "3D",
    "title": "Threaded Optimization",
    "value": "Off",
    "tradeoff": "Primarily relevant to supported OpenGL paths. Off can reduce performance; Auto is a reasonable starting point for other systems.",
    "route": "Manage 3D settings",
    "perGame": true
  },
  {
    "id": "nvidia-28",
    "category": "3D",
    "title": "Triple Buffering",
    "value": "Off",
    "tradeoff": "Driver triple buffering primarily applies to OpenGL with V-Sync; it is not a universal latency switch.",
    "route": "Manage 3D settings",
    "perGame": true
  },
  {
    "id": "nvidia-29",
    "category": "3D",
    "title": "Vertical Sync",
    "value": "Use the 3D Application Setting",
    "tradeoff": "Configure tearing, VRR and frame pacing together in the game. V-Sync can affect latency when GPU-bound.",
    "route": "Manage 3D settings",
    "perGame": true
  },
  {
    "id": "nvidia-30",
    "category": "3D",
    "title": "Virtual Reality pre-rendered frames",
    "value": "1",
    "tradeoff": "VR runtime and application behavior matter; this is not a universal non-VR optimization.",
    "route": "Manage 3D settings",
    "perGame": true
  },
  {
    "id": "nvidia-31",
    "category": "3D",
    "title": "Virtual Reality – Variable Rate Super Sampling",
    "value": "Off",
    "tradeoff": "VRSS requires compatible VR hardware and applications. It can improve quality using GPU headroom.",
    "route": "Manage 3D settings",
    "perGame": true
  },
  {
    "id": "nvidia-32",
    "category": "3D",
    "title": "Vulkan/OpenGL present method",
    "value": "Prefer native",
    "tradeoff": "Presentation compatibility varies by application. Revert to the default if capture, overlays or presentation fail.",
    "route": "Manage 3D settings",
    "perGame": true
  },
  {
    "id": "nvidia-33",
    "category": "Display & color",
    "title": "Display Resolution",
    "value": "1920 × 1080",
    "tradeoff": "Personal reference resolution, not a recommendation to lower every display to 1080p.",
    "route": "Change resolution",
    "perGame": false
  },
  {
    "id": "nvidia-34",
    "category": "Display & color",
    "title": "Refresh Rate",
    "value": "360 Hz",
    "tradeoff": "Select only a refresh rate supported by your monitor, cable and active mode. Do not create an unsupported custom mode.",
    "route": "Change resolution",
    "perGame": false
  },
  {
    "id": "nvidia-35",
    "category": "Display & color",
    "title": "Scaling Mode",
    "value": "Full-screen",
    "tradeoff": "Can stretch content with a different aspect ratio. Aspect ratio scaling preserves proportions.",
    "route": "Adjust desktop size and position",
    "perGame": false
  },
  {
    "id": "nvidia-36",
    "category": "Display & color",
    "title": "Scaling Processor",
    "value": "GPU",
    "tradeoff": "The preferred scaling path depends on the monitor and use case. This does not establish a latency advantage.",
    "route": "Adjust desktop size and position",
    "perGame": false
  },
  {
    "id": "nvidia-37",
    "category": "Display & color",
    "title": "Override Scaling Mode",
    "value": "Enabled",
    "tradeoff": "Overrides application scaling preferences and may change how older or lower-resolution games are displayed.",
    "route": "Adjust desktop size and position",
    "perGame": false
  },
  {
    "id": "nvidia-38",
    "category": "Display & color",
    "title": "Digital Vibrance",
    "value": "70%",
    "tradeoff": "A personal color-saturation preference. It does not improve FPS and may oversaturate content.",
    "route": "Adjust desktop color settings",
    "perGame": false
  },
  {
    "id": "nvidia-39",
    "category": "Display & color",
    "title": "Brightness",
    "value": "50%",
    "tradeoff": "Driver adjustment changes image levels. Use display calibration rather than treating this as a performance setting.",
    "route": "Adjust desktop color settings",
    "perGame": false
  },
  {
    "id": "nvidia-40",
    "category": "Display & color",
    "title": "Contrast",
    "value": "50%",
    "tradeoff": "Excessive contrast can clip detail. This is a color preference, not a performance change.",
    "route": "Adjust desktop color settings",
    "perGame": false
  },
  {
    "id": "nvidia-41",
    "category": "Display & color",
    "title": "Gamma",
    "value": "1.00",
    "tradeoff": "Affects midtones. Check visibility without crushing shadows or washing out the image.",
    "route": "Adjust desktop color settings",
    "perGame": false
  },
  {
    "id": "nvidia-42",
    "category": "Display & color",
    "title": "Color channel",
    "value": "All channels",
    "tradeoff": "The reference adjustments affect all color channels together.",
    "route": "Adjust desktop color settings",
    "perGame": false
  },
  {
    "id": "nvidia-43",
    "category": "Display & color",
    "title": "Color accuracy mode",
    "value": "Accurate",
    "tradeoff": "This is the reported mode in the screenshot, not a value PANDORA has read from your PC.",
    "route": "Adjust desktop color settings",
    "perGame": false
  },
  {
    "id": "nvidia-44",
    "category": "Display & color",
    "title": "Override to reference mode",
    "value": "Disabled",
    "tradeoff": "Overriding reference mode affects the color pipeline; review color-management needs before changing it.",
    "route": "Adjust desktop color settings",
    "perGame": false
  },
  {
    "id": "nvidia-45",
    "category": "Additional",
    "title": "Image settings with preview",
    "value": "Use the advanced 3D image settings",
    "tradeoff": "Allows detailed configuration in Manage 3D settings rather than the single performance/quality slider.",
    "route": "Adjust image settings with preview",
    "perGame": false
  },
  {
    "id": "nvidia-46",
    "category": "Additional",
    "title": "PhysX Processor",
    "value": "NVIDIA GeForce RTX 5080",
    "tradeoff": "The reference GPU belongs to Sonnier’s PC. On other hardware use a supported processor or Auto-select.",
    "route": "Configure Surround, PhysX",
    "perGame": false
  },
  {
    "id": "nvidia-47",
    "category": "Additional",
    "title": "Surround",
    "value": "Unchecked (unavailable in reference)",
    "tradeoff": "Surround combines compatible displays. A disabled checkbox in a screenshot does not establish support on this PC.",
    "route": "Configure Surround, PhysX",
    "perGame": false
  },
  {
    "id": "nvidia-48",
    "category": "Video",
    "title": "Video color adjustment",
    "value": "With the NVIDIA settings",
    "tradeoff": "Driver video adjustments apply to compatible playback paths and can differ from desktop output settings.",
    "route": "Adjust video color settings",
    "perGame": false
  },
  {
    "id": "nvidia-49",
    "category": "Video",
    "title": "Video Dynamic Range",
    "value": "Full (0–255)",
    "tradeoff": "This is video-playback range, not proof of desktop RGB output range. Match the player and display pipeline to avoid crushed blacks or washed-out output.",
    "route": "Adjust video color settings",
    "perGame": false
  },
  {
    "id": "nvidia-50",
    "category": "Video",
    "title": "Edge enhancement",
    "value": "Use the video player setting",
    "tradeoff": "The player controls sharpening in this reference. Driver sharpening can introduce halos.",
    "route": "Adjust video image settings",
    "perGame": false
  },
  {
    "id": "nvidia-51",
    "category": "Video",
    "title": "Noise reduction",
    "value": "Use the video player setting",
    "tradeoff": "The player controls denoising; excessive filtering can remove detail.",
    "route": "Adjust video image settings",
    "perGame": false
  },
  {
    "id": "nvidia-52",
    "category": "Video",
    "title": "Inverse telecine",
    "value": "Off",
    "tradeoff": "Relevant to interlaced/telecined video rather than game performance.",
    "route": "Adjust video image settings",
    "perGame": false
  },
  {
    "id": "nvidia-53",
    "category": "Video",
    "title": "RTX video Super resolution",
    "value": "Off (status: Inactive)",
    "tradeoff": "Supported RTX video enhancement can improve playback quality while using GPU resources. Reference Quality Auto is disabled.",
    "route": "Adjust video image settings",
    "perGame": false
  },
  {
    "id": "nvidia-54",
    "category": "Video",
    "title": "RTX video High Dynamic Range",
    "value": "Off (unavailable in reference)",
    "tradeoff": "The screenshot asks to enable HDR in Windows. Availability depends on hardware, Windows HDR and supported video playback.",
    "route": "Adjust video image settings",
    "perGame": false
  }
];
export const NVIDIA_PRESET_NAME = "Sonnier’s NVIDIA Setup";
