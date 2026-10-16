#pragma once
#include <stdint.h>
#ifdef __cplusplus
extern "C" {
#endif
// All control calls are serialized by the owner, except load (one loader queue)
// and read/collect (one detector worker). Destroy only after joining both queues.
void* rig_create(void);
void rig_destroy(void* rig);
int rig_start(void* rig, const char* input, const char* output, int channel, int block, char* error, int capacity);
void rig_stop(void* rig);
void rig_request(void* rig, uint64_t generation);
int rig_load(void* rig, const char* path, uint64_t generation, float inputDB, float outputDB, float gateDB, float reverb, char* error, int capacity);
void rig_controls(void* rig, float inputDB, float outputDB, float gateDB, float reverb, int muted);
void rig_mute(void* rig, int muted);
int rig_read(void* rig, float* data, int capacity);
void rig_collect(void* rig);
uint64_t rig_dropped(void* rig);
uint64_t rig_active_generation(void* rig);
uint64_t rig_callbacks(void* rig);
int rig_fault(void* rig);
int rig_buffer_size(void* rig);
double rig_callback_ms(void* rig);
// Offline production DSP entry point; no hardware or microphone is opened.
void rig_render(void* rig, const float* input, float* left, float* right, int count);
#ifdef __cplusplus
}
#endif
