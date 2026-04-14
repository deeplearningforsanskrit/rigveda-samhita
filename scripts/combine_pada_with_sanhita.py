import json


def main():

    with open(f"new_rigveda_joined.json", "r") as f:
        sanhita_data = json.load(f)
    new_data = {}
    for mandala in range(1, 11):
        with open(f"rigveda_pada_patha_{mandala}.json", "r") as f:
            pada_lines = json.load(f)

        for pada_line in pada_lines:
            sanhita_key = str(int(pada_line['rik_num'][:2]))+ pada_line['rik_num'][2:]
            new_key = ".".join(map(lambda x: str(int(x)), pada_line['rik_num'].split(".")))  # Extract the mandala number
            # print(sanhita_key, new_key, pada_line['rik_num'])
            if sanhita_key in [ '1.191.17','3.040.01']: 
                import pdb; pdb.set_trace()
                break
            new_data[new_key] = sanhita_data[sanhita_key]
            new_data[new_key]['pada_patha'] = pada_line['pada_dev_acc']


    with open(f"rigveda_padapath_combined.json", "w") as f:
        json.dump(new_data, f, ensure_ascii=False, indent=4) 
    


if __name__ == "__main__":
    main()


