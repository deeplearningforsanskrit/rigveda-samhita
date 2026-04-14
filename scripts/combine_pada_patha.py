import json 

def main():
    richa_num = 1
    all_data = {}
    for mandala in range(1, 11):
        with open(f"rigveda_pada_patha_{mandala:02d}.json", "r", encoding="utf-8") as f:
            data = json.load(f)
            # Process the data as needed
        for mantra in data:
            
            rik_num = mantra["rik_num"]
            if rik_num not in all_data:
                all_data[rik_num] = {
                    "richa_num": richa_num,
                    "rik_num": rik_num,
                    "ashtaka_ref": mantra["ashtaka_ref"],
                    "anuvaka_ref": mantra["anuvaka_ref"],
                    "samh_dev_acc": mantra["samh_dev_acc"],
                    "pada_dev_acc": mantra["pada_dev_acc"],
                }
                richa_num+=1
            else:
                # Handle duplicates if necessary
                print(f"Duplicate rik_num {rik_num} found in mandala {mandala:02d}, skipping.")
                pass
    with open("rigveda_pada_patha_combined.json", "w", encoding="utf-8") as f:
        json.dump(all_data, f, ensure_ascii=False, indent=2)

if __name__ == "__main__":
    main()